import { LeagueRankingEntry, PlayerProfile, RankedStat } from '../entities';

export interface PlayerRepository {
  getPlayerProfile(playerId: number, seasonYear: number): Promise<PlayerProfile>;
  /** Tutti i giocatori della stagione classificati per una statistica media. */
  getLeagueRanking(stat: RankedStat, seasonYear: number): Promise<LeagueRankingEntry[]>;
}
