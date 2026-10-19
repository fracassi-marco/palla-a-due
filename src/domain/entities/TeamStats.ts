/** Posizione di una squadra in una classifica statistica, con il valore medio. */
export interface RankedValue {
  /** Posizione tra le squadre del campionato (1 = migliore); null se non disponibile. */
  position: number | null;
  value: number;
}

export interface TeamResult {
  matchId: number;
  date: Date;
  opponentName: string;
  isHome: boolean;
  teamScore: number;
  opponentScore: number;
  won: boolean;
}

export interface Streak {
  won: boolean;
  length: number;
}

export interface WinLoss {
  wins: number;
  losses: number;
}

export interface TeamStats {
  teamId: number;
  seasonYear: number;
  /** Posizione in classifica generale. */
  position: number | null;
  /** Punti in classifica (2 a vittoria). */
  leaguePoints: number;
  played: number;
  wins: number;
  losses: number;
  home: WinLoss;
  away: WinLoss;
  streak: Streak | null;
  /** Ultimi risultati, dal più recente. */
  form: TeamResult[];
  avgPointsFor: RankedValue;
  /** La posizione 1 è la difesa migliore (meno punti subiti). */
  avgPointsAgainst: RankedValue;
  /** Differenza media punti fatti - subiti. */
  avgMargin: number;
  totalRebounds: RankedValue;
  offensiveRebounds: number;
  defensiveRebounds: number;
  assists: RankedValue;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
  rating: number;
  /** Percentuali di tiro (0-100); null se non ci sono tentativi. */
  twoPercent: number | null;
  threePercent: number | null;
  freeThrowPercent: number | null;
  biggestWin: TeamResult | null;
  biggestLoss: TeamResult | null;
  highestScore: TeamResult | null;
}
