import { BoxScore, Match } from '../entities';

export interface MatchRepository {
  /** Partite della giornata corrente del campionato. */
  getCurrentDayMatches(competitionId: number): Promise<Match[]>;
  /** Partite di una giornata specifica; lista vuota se la giornata non esiste. */
  getMatchesByDay(competitionId: number, dayNumber: number): Promise<Match[]>;
  /** Statistiche dei giocatori di una partita (in corso o conclusa); vuote se non disponibili. */
  getBoxScore(matchId: number): Promise<BoxScore>;
}
