import { StatLine } from './PlayerStats';

/** Statistiche dei giocatori di una singola partita, indicizzate per id giocatore. */
export interface BoxScore {
  home: Record<number, StatLine>;
  away: Record<number, StatLine>;
}
