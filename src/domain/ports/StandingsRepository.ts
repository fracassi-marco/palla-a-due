import { Standing } from '../entities';

export interface StandingsRepository {
  getStandings(competitionId: number): Promise<Standing[]>;
}
