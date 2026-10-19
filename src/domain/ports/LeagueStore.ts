import { Competition, Match, MatchBoxScore, MatchStatus, Roster } from '../entities';

export interface StoredCompetition extends Competition {
  /** Numero di giornate, noto dopo aver scaricato la prima. */
  totalDays: number | null;
}

/** Stato di sincronizzazione di una giornata già scaricata almeno una volta. */
export interface DaySyncState {
  dayNumber: number;
  /** Timestamp (ms) dell'ultimo download. */
  fetchedAt: number;
  /** Tutte le partite concluse: la giornata non cambia più. */
  complete: boolean;
  hasLive: boolean;
  /** Palla a due (ms) della prima partita non conclusa. */
  nextKickoff: number | null;
}

export interface MatchSyncInfo {
  id: number;
  competitionId: number;
  dayNumber: number;
  status: MatchStatus;
  startsAt: Date;
  /** Box score definitivo già salvato: non va più scaricato. */
  boxScoreFinal: boolean;
}

/** Lato scrittura del database locale: ciò che serve alla sincronizzazione. */
export interface LeagueStore {
  getCompetition(seasonYear: number): Promise<StoredCompetition | null>;
  saveCompetition(competition: Competition, totalDays: number | null): Promise<void>;

  getDaySyncStates(competitionId: number): Promise<DaySyncState[]>;
  saveDay(competitionId: number, dayNumber: number, matches: Match[], fetchedAt: number): Promise<void>;

  getMatchSyncInfo(matchId: number): Promise<MatchSyncInfo | null>;
  /** Partite concluse il cui box score manca o non è ancora definitivo. */
  getPendingBoxScores(competitionId: number, now: number): Promise<MatchSyncInfo[]>;
  saveBoxScore(matchId: number, boxScore: MatchBoxScore, final: boolean, fetchedAt: number): Promise<void>;

  /** Squadre senza roster o con giocatori sconosciuti scesi in campo dopo l'ultimo download. */
  getTeamsNeedingRoster(competitionId: number): Promise<number[]>;
  saveRoster(roster: Roster, fetchedAt: number): Promise<void>;
}
