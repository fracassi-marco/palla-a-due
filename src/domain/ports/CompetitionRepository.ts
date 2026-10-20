import { Competition } from '../entities';

export interface CompetitionRepository {
  /** Competizioni della Regular Season per la stagione indicata (anno di inizio): una, o una per girone. */
  getSeasonCompetitions(seasonYear: number): Promise<Competition[]>;
}
