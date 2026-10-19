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

export interface PlayerProfile {
  player: Player;
  seasonYear: number;
  averages: StatLine | null;
  highs: StatLine | null;
  totals: StatLine | null;
  gameLog: GameLogEntry[];
}
