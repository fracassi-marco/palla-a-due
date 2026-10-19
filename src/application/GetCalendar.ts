import { Match } from '../domain/entities';
import { CompetitionRepository, MatchRepository, StandingsRepository } from '../domain/ports';
import { GetCurrentRound } from './GetCurrentRound';
import { currentSeasonYear } from './season';

const DEFAULT_TOTAL_DAYS = 30;

export interface CalendarOverview {
  competitionId: number;
  /** Giornata da mostrare per prima: stessa logica della home. */
  initialDay: number;
  totalDays: number;
}

export class GetCalendar {
  constructor(
    private readonly competitions: CompetitionRepository,
    private readonly matches: MatchRepository,
    private readonly standings: StandingsRepository,
    private readonly currentRound: GetCurrentRound,
  ) {}

  async overview(now: Date = new Date()): Promise<CalendarOverview> {
    const competition = await this.competitions.getCurrentRegularSeason(currentSeasonYear(now));
    const [round, standings] = await Promise.all([
      this.currentRound.execute(now),
      this.standings.getStandings(competition.id).catch(() => []),
    ]);
    // Girone all'italiana andata/ritorno: 2 * (squadre - 1) giornate.
    const totalDays = standings.length > 1 ? 2 * (standings.length - 1) : DEFAULT_TOTAL_DAYS;
    return { competitionId: competition.id, initialDay: round[0]?.dayNumber ?? 1, totalDays };
  }

  async day(competitionId: number, dayNumber: number): Promise<Match[]> {
    const round = await this.matches.getMatchesByDay(competitionId, dayNumber);
    return [...round].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  }
}
