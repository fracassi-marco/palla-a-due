import { StatLine } from './PlayerStats';

/** Statistiche dei giocatori di una singola partita, indicizzate per id giocatore. */
export interface BoxScore {
  home: Record<number, StatLine>;
  away: Record<number, StatLine>;
}

/** Tutto ciò che il box score della Lega espone su una partita, per un giocatore o per l'intera squadra. */
export interface GameStats {
  minutes: number;
  points: number;
  fouls: number;
  foulsDrawn: number;
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
  blocksAgainst: number;
  rating: number;
}

export interface BoxScorePlayer {
  id: number;
  firstName: string;
  lastName: string;
  number: string;
  photoUrl: string | null;
  starter: boolean;
  plusMinus: number;
  stats: GameStats;
}

export interface BoxScoreSide {
  players: BoxScorePlayer[];
  /** Totali ufficiali di squadra: includono rimbalzi e palle perse "di squadra". */
  totals: GameStats;
}

/** Box score completo, nella forma in cui viene scaricato e salvato nel database. */
export interface MatchBoxScore {
  home: BoxScoreSide;
  away: BoxScoreSide;
}
