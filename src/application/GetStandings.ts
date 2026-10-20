import { StandingsGroup } from '../domain/entities';
import { CompetitionRepository, StandingsRepository } from '../domain/ports';
import { currentSeasonYear } from './season';

export class GetStandings {
  constructor(
    private readonly competitions: CompetitionRepository,
    private readonly standings: StandingsRepository,
  ) {}

  /** Una classifica per competizione della stagione corrente (più d'una solo con i gironi). */
  async execute(): Promise<StandingsGroup[]> {
    const competitions = await this.competitions.getSeasonCompetitions(currentSeasonYear());
    return Promise.all(
      competitions.map(async (c) => ({
        competitionId: c.id,
        name: c.name,
        standings: await this.standings.getStandings(c.id),
      })),
    );
  }
}
