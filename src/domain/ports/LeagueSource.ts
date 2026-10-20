import { Competition, Match, MatchBoxScore, Roster } from '../entities';

/** Fonte remota dei dati della Lega: viene interrogata solo per ciò che il database locale non ha ancora. */
export interface LeagueSource {
  /** Competizioni della Regular Season per la stagione indicata (anno di inizio): una, o una per girone. */
  findRegularSeasons(seasonYear: number): Promise<Competition[]>;
  /** Partite di una giornata; lista vuota se la giornata non esiste. */
  getDay(competitionId: number, dayNumber: number): Promise<Match[]>;
  /** Box score di una partita in corso o conclusa; vuoto se non ancora disponibile. */
  getBoxScore(matchId: number): Promise<MatchBoxScore>;
  getRoster(teamId: number): Promise<Roster>;
}
