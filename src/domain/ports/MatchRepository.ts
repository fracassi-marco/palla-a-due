import { BoxScore, Match } from '../entities';

export interface MatchRepository {
  /**
   * Partite della giornata "corrente": quella della prossima palla a due (o in corso),
   * altrimenti l'ultima giornata giocata.
   */
  getCurrentDayMatches(competitionId: number, now: Date): Promise<Match[]>;
  /** Partite di una giornata specifica; lista vuota se la giornata non c'è. */
  getMatchesByDay(competitionId: number, dayNumber: number): Promise<Match[]>;
  /** Partite concluse tra due squadre (in casa o in trasferta), dalla più recente; `excludeMatchId` lascia fuori quella in esame. */
  getHeadToHead(teamAId: number, teamBId: number, excludeMatchId: number, limit: number): Promise<Match[]>;
  /** Statistiche dei giocatori di una partita; vuote se non ancora scaricate. */
  getBoxScore(matchId: number): Promise<BoxScore>;
}
