import { Competition } from '../entities';

export interface CompetitionRepository {
  /** Regular Season di Serie A per la stagione indicata (anno di inizio). */
  getCurrentRegularSeason(seasonYear: number): Promise<Competition>;
}
