import { Competition, Match, MatchBoxScore, Roster } from '../entities';

/** Fonte remota dei dati della Lega: viene interrogata solo per ciò che il database locale non ha ancora. */
export interface LeagueSource {
  /** Regular Season di Serie A per la stagione indicata (anno di inizio). */
  findRegularSeason(seasonYear: number): Promise<Competition>;
  /** Partite di una giornata; lista vuota se la giornata non esiste. */
  getDay(competitionId: number, dayNumber: number): Promise<Match[]>;
  /** Box score di una partita in corso o conclusa; vuoto se non ancora disponibile. */
  getBoxScore(matchId: number): Promise<MatchBoxScore>;
  getRoster(teamId: number): Promise<Roster>;
}
