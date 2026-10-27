import { TeamRef } from './Team';

/** Una serie playoff: `top` è la squadra con il fattore campo (gara 1 in casa). */
export interface PlayoffSeries {
  id: string;
  top: TeamRef;
  bottom: TeamRef;
  /** Teste di serie, se la fonte le dà. */
  topSeed: number | null;
  bottomSeed: number | null;
  topWins: number;
  bottomWins: number;
  /** Partite per vincere la serie al meglio di `bestOf`. */
  bestOf: number;
  /** Id della squadra che ha vinto la serie; null finché è aperta. */
  winnerId: number | null;
  live: boolean;
  /** Prossima partita non ancora giocata, se già in calendario. */
  nextGameAt: Date | null;
}

export interface PlayoffRound {
  name: string;
  /** Serie del turno in ordine di tabellone; `null` = ancora da definire. */
  series: (PlayoffSeries | null)[];
}

/** Dal primo turno alla finale. */
export interface PlayoffBracket {
  rounds: PlayoffRound[];
}
