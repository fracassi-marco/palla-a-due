import { Match } from '../domain/entities';
import { CompetitionRepository, MatchRepository } from '../domain/ports';
import { nextRomeNoon } from '../domain/romeTime';
import { currentSeasonYear } from './season';

const HOURS = 60 * 60 * 1000;
/** L'API non espone la fine della partita: la stimiamo dalla palla a due. */
const MATCH_DURATION_MS = 2 * HOURS;
const MAX_DAYS_LOOKAHEAD = 3;

export class GetCurrentRound {
  constructor(
    private readonly competitions: CompetitionRepository,
    private readonly matches: MatchRepository,
  ) {}

  /** Partite da mostrare: la giornata corrente di ogni competizione (una sola, tranne che con i gironi). */
  async execute(now: Date = new Date()): Promise<Match[]> {
    const competitions = await this.competitions.getSeasonCompetitions(currentSeasonYear(now));
    const rounds = await Promise.all(competitions.map((c) => this.competitionRound(c.id, now)));
    return sortForDisplay(rounds.flat());
  }

  /**
   * Partite della giornata da mostrare: quella in corso o conclusa che resta in vista fino al
   * mezzogiorno italiano successivo all'ultima partita, altrimenti la prossima.
   */
  private async competitionRound(competitionId: number, now: Date): Promise<Match[]> {
    const focus = await this.matches.getCurrentDayMatches(competitionId, now);
    if (focus.length === 0) return [];

    const focusDay = focus[0].dayNumber;
    // La giornata precedente può essere ancora nella finestra delle 48 ore.
    const days = [focusDay - 1, focusDay, ...range(focusDay + 1, focusDay + MAX_DAYS_LOOKAHEAD)].filter((d) => d >= 1);

    let last: Match[] = focus;
    for (const day of days) {
      const round = day === focusDay ? focus : await this.matches.getMatchesByDay(competitionId, day);
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
    return now < nextRomeNoon(new Date(lastStart + MATCH_DURATION_MS));
  }
}

const STATUS_ORDER = { live: 0, scheduled: 1, finished: 2 } as const;

/** Prima le live, poi le prossime (la più vicina per prima), infine le concluse (la più recente per prima). */
function sortForDisplay(matches: Match[]): Match[] {
  return [...matches].sort((a, b) => {
    if (a.status !== b.status) return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    const diff = a.startsAt.getTime() - b.startsAt.getTime();
    return a.status === 'finished' ? -diff : diff;
  });
}

const sortByStart = (round: Match[]) => [...round].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}
