import { Match } from '../domain/entities';
import { CompetitionRepository, MatchRepository } from '../domain/ports';
import { currentSeasonYear } from './season';

const HOURS = 60 * 60 * 1000;
/** L'API non espone la fine della partita: la stimiamo dalla palla a due. */
const MATCH_DURATION_MS = 2 * HOURS;
const RECENT_ROUND_WINDOW_MS = 48 * HOURS;
const MAX_DAYS_LOOKAHEAD = 3;

export class GetCurrentRound {
  constructor(
    private readonly competitions: CompetitionRepository,
    private readonly matches: MatchRepository,
  ) {}

  /**
   * Partite della giornata da mostrare: quella in corso o conclusa da meno di 48 ore
   * (calcolate sull'ultima partita della giornata), altrimenti la prossima.
   */
  async execute(now: Date = new Date()): Promise<Match[]> {
    const competition = await this.competitions.getCurrentRegularSeason(currentSeasonYear(now));
    const focus = await this.matches.getCurrentDayMatches(competition.id, now);
    if (focus.length === 0) return [];

    const focusDay = focus[0].dayNumber;
    // La giornata precedente può essere ancora nella finestra delle 48 ore.
    const days = [focusDay - 1, focusDay, ...range(focusDay + 1, focusDay + MAX_DAYS_LOOKAHEAD)].filter((d) => d >= 1);

    let last: Match[] = focus;
    for (const day of days) {
      const round = day === focusDay ? focus : await this.matches.getMatchesByDay(competition.id, day);
      if (round.length === 0) continue;
      last = round;
      if (this.isActiveOrRecent(round, now)) return sortByStart(round);
    }
    return sortByStart(last);
  }

  private isActiveOrRecent(round: Match[], now: Date): boolean {
    if (round.some((m) => m.status !== 'finished')) {
      // Ancora da giocare: vale solo se la giornata è davvero iniziata o è la prima non conclusa.
      return true;
    }
    const lastStart = Math.max(...round.map((m) => m.startsAt.getTime()));
    return now.getTime() - (lastStart + MATCH_DURATION_MS) < RECENT_ROUND_WINDOW_MS;
  }
}

const sortByStart = (round: Match[]) => [...round].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}
