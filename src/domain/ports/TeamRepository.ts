import { Roster, TeamResult } from '../entities';

/** Medie stagionali di squadra, calcolate dai box score salvati. */
export interface TeamSeasonStats {
  /** Posizione tra le squadre del campionato (1 = migliore) in alcune classifiche statistiche. */
  pointsRank: number | null;
  reboundsRank: number | null;
  assistsRank: number | null;
  avgPoints: number;
  avgOffensiveRebounds: number;
  avgDefensiveRebounds: number;
  avgAssists: number;
  avgSteals: number;
  avgBlocks: number;
  avgTurnovers: number;
  avgFouls: number;
  avgRating: number;
  twoPercent: number | null;
  threePercent: number | null;
  freeThrowPercent: number | null;
}

export interface TeamRepository {
  getRoster(teamId: number): Promise<Roster>;
  /** Statistiche stagionali; null se la squadra non ha ancora giocato. */
  getSeasonStats(teamId: number, seasonYear: number): Promise<TeamSeasonStats | null>;
  /** Partite giocate (con punteggio) dalla più vecchia alla più recente. */
  getResults(teamId: number, seasonYear: number): Promise<(TeamResult)[]>;
}
