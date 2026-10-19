import { Player } from './Player';

/** Una riga di statistiche: media, massimo o totale della stagione, oppure una singola partita. */
export interface StatLine {
  points: number;
  minutes: number;
  matches: number;
  twoMade: number;
  twoAttempted: number;
  threeMade: number;
  threeAttempted: number;
  freeThrowsMade: number;
  freeThrowsAttempted: number;
  offensiveRebounds: number;
  defensiveRebounds: number;
  totalRebounds: number;
  assists: number;
  steals: number;
  turnovers: number;
  blocks: number;
  fouls: number;
  /** Valutazione Lega (equivalente del PIR). */
  rating: number;
}

export interface GameLogEntry {
  matchId: number;
  date: Date;
  opponentName: string;
  opponentLogoUrl: string | null;
  isHome: boolean;
  teamScore: number;
  opponentScore: number;
  won: boolean;
  line: StatLine;
}

/** Statistiche a media di cui si calcola la posizione tra tutti i giocatori della lega. */
export type RankedStat =
  | 'points'
  | 'minutes'
  | 'totalRebounds'
  | 'assists'
  | 'rating'
  | 'steals'
  | 'blocks'
  | 'turnovers'
  | 'twoPercent'
  | 'threePercent'
  | 'freeThrowPercent';

/** Posizione (1 = migliore) su `of` giocatori classificati per quella statistica. */
export interface LeaguePosition {
  position: number;
  of: number;
}

/** Una riga della classifica di lega per una statistica. `value` è la media (o la quota, 0-1, per le percentuali). */
export interface LeagueRankingEntry {
  position: number;
  value: number;
  matches: number;
  player: Player;
}

export type LeagueRanks = Partial<Record<RankedStat, LeaguePosition>>;

export interface PlayerProfile {
  player: Player;
  seasonYear: number;
  averages: StatLine | null;
  highs: StatLine | null;
  totals: StatLine | null;
  /** Posizione di ogni media rispetto a tutti i giocatori della stagione. */
  ranks: LeagueRanks;
  gameLog: GameLogEntry[];
}
