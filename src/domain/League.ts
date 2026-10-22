export type LeagueId = 'lba' | 'a2' | 'b' | 'euroleague' | 'eurocup' | 'nba';

/** Raggruppamento delle squadre in classifica all'interno di un'unica competizione (le conference NBA): `teamCodes` sono i `TeamRef.code`. */
export interface Conference {
  name: string;
  teamCodes: string[];
}

export interface LeagueInfo {
  id: LeagueId;
  /** Etichetta del selettore. */
  label: string;
  /** Testata della home. */
  title: string;
  /** Posti playoff e retrocessione marcati in classifica; 0 = nessuna zona evidenziata. */
  playoffSpots: number;
  relegationSpots: number;
  /** Classifica per percentuale di vittorie invece che per punti: le squadre non hanno giocato lo stesso numero di partite. */
  byWinPercentage?: boolean;
  /** Posti di spareggio subito dopo quelli playoff (il play-in NBA: dal 7° al 10°). */
  playInSpots?: number;
  /** Classifica divisa per conference; `playoffSpots` e `playInSpots` valgono per ciascuna. */
  conferences?: Conference[];
}

const NBA_CONFERENCES: Conference[] = [
  { name: 'Conference Est', teamCodes: ['ATL', 'BOS', 'BKN', 'CHA', 'CHI', 'CLE', 'DET', 'IND', 'MIA', 'MIL', 'NYK', 'ORL', 'PHI', 'TOR', 'WAS'] },
  { name: 'Conference Ovest', teamCodes: ['DAL', 'DEN', 'GSW', 'HOU', 'LAC', 'LAL', 'MEM', 'MIN', 'NOP', 'OKC', 'PHX', 'POR', 'SAC', 'SAS', 'UTA'] },
];

export const DEFAULT_LEAGUE: LeagueId = 'lba';

export const LEAGUES: LeagueInfo[] = [
  { id: 'lba', label: 'LBA', title: 'LEGA BASKET SERIE A', playoffSpots: 8, relegationSpots: 2 },
  { id: 'nba', label: 'NBA', title: 'NBA', playoffSpots: 6, playInSpots: 4, relegationSpots: 0, byWinPercentage: true, conferences: NBA_CONFERENCES },
  { id: 'a2', label: 'SERIE A2', title: 'SERIE A2 · LNP', playoffSpots: 0, relegationSpots: 0 },
  { id: 'b', label: 'SERIE B', title: 'SERIE B NAZIONALE · LNP', playoffSpots: 0, relegationSpots: 0 },
  { id: 'euroleague', label: 'EUROLEAGUE', title: 'EUROLEAGUE', playoffSpots: 6, relegationSpots: 0 },
  { id: 'eurocup', label: 'EUROCUP', title: 'EUROCUP', playoffSpots: 0, relegationSpots: 0 },
];

export const leagueInfo = (id: LeagueId): LeagueInfo => LEAGUES.find((l) => l.id === id) ?? LEAGUES[0];

export const isLeagueId = (value: unknown): value is LeagueId => LEAGUES.some((l) => l.id === value);
