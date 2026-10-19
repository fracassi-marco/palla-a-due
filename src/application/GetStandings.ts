import { Standing } from '../domain/entities';
import { CompetitionRepository, StandingsRepository } from '../domain/ports';
import { currentSeasonYear } from './season';

export class GetStandings {
  constructor(
    private readonly competitions: CompetitionRepository,
    private readonly standings: StandingsRepository,
  ) {}

  async execute(): Promise<Standing[]> {
    const competition = await this.competitions.getCurrentRegularSeason(currentSeasonYear());
    return this.standings.getStandings(competition.id);
  }
}
