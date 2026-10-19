import { Match } from '../entities';

export interface MatchRepository {
  /** Partite della giornata corrente del campionato. */
  getCurrentDayMatches(competitionId: number): Promise<Match[]>;
  /** Partite di una giornata specifica; lista vuota se la giornata non esiste. */
  getMatchesByDay(competitionId: number, dayNumber: number): Promise<Match[]>;
}
