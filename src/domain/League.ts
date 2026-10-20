export type LeagueId = 'lba' | 'a2' | 'b' | 'euroleague' | 'eurocup';

export interface LeagueInfo {
  id: LeagueId;
  /** Etichetta del selettore. */
  label: string;
  /** Testata della home. */
  title: string;
  /** Posti playoff e retrocessione marcati in classifica; 0 = nessuna zona evidenziata. */
  playoffSpots: number;
  relegationSpots: number;
}

export const DEFAULT_LEAGUE: LeagueId = 'lba';

export const LEAGUES: LeagueInfo[] = [
  { id: 'lba', label: 'LBA', title: 'LEGA BASKET SERIE A', playoffSpots: 8, relegationSpots: 2 },
  { id: 'a2', label: 'SERIE A2', title: 'SERIE A2 · LNP', playoffSpots: 0, relegationSpots: 0 },
  { id: 'b', label: 'SERIE B', title: 'SERIE B NAZIONALE · LNP', playoffSpots: 0, relegationSpots: 0 },
  { id: 'euroleague', label: 'EUROLEAGUE', title: 'EUROLEAGUE', playoffSpots: 6, relegationSpots: 0 },
  { id: 'eurocup', label: 'EUROCUP', title: 'EUROCUP', playoffSpots: 0, relegationSpots: 0 },
];

export const leagueInfo = (id: LeagueId): LeagueInfo => LEAGUES.find((l) => l.id === id) ?? LEAGUES[0];

export const isLeagueId = (value: unknown): value is LeagueId => LEAGUES.some((l) => l.id === value);
