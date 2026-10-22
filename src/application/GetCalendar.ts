import { Match } from '../domain/entities';
import { CompetitionRepository, MatchRepository, StandingsRepository } from '../domain/ports';
import { GetCurrentRound } from './GetCurrentRound';
import { currentSeasonYear } from './season';

const DEFAULT_TOTAL_DAYS = 30;

export interface CalendarOverview {
  /** Competizioni della stagione: più d'una solo con i gironi, che giocano le stesse giornate. */
  competitionIds: number[];
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
    const competitions = await this.competitions.getSeasonCompetitions(currentSeasonYear(now));
    const [round, tables] = await Promise.all([
      this.currentRound.execute(now),
      Promise.all(competitions.map((c) => this.standings.getStandings(c.id).catch(() => []))),
    ]);
    // Il numero di giornate lo dà la fonte (NBA: settimane); altrimenti girone all'italiana andata/ritorno: 2 * (squadre - 1).
    const totalDays = Math.max(
      ...tables.map((standings, i) =>
        competitions[i].totalDays ?? (standings.length > 1 ? 2 * (standings.length - 1) : DEFAULT_TOTAL_DAYS),
      ),
    );
    return { competitionIds: competitions.map((c) => c.id), initialDay: round[0]?.dayNumber ?? 1, totalDays };
  }

  async day(competitionIds: number[], dayNumber: number): Promise<Match[]> {
    const rounds = await Promise.all(competitionIds.map((id) => this.matches.getMatchesByDay(id, dayNumber)));
    return rounds.flat().sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  }
}
