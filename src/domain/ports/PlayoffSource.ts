import { PlayoffBracket } from '../entities';

/** Fonte del tabellone playoff di una stagione (anno di inizio). */
export interface PlayoffSource {
  /** `null` se i playoff non sono ancora iniziati. */
  getBracket(seasonYear: number): Promise<PlayoffBracket | null>;
}
