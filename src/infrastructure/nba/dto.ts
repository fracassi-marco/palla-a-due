/** Forma dei dati di `cdn.nba.com` (solo i campi letti dall'app). */
export interface ScheduleTeamDto {
  teamId: number;
  teamTricode: string;
  score: number;
}

export interface ScheduleGameDto {
  gameId: string;
  /** "20261020/BOSDET": data in ora della costa Est, ospiti, casa. */
  gameCode: string;
  /** 1 = da giocare, 2 = in corso, 3 = conclusa. */
  gameStatus: number;
  gameDateTimeUTC: string;
  /** Vuota per le partite normali; "Quarterfinal", "Semifinal"... per la fase a eliminazione della NBA Cup. */
  gameSubLabel: string;
  arenaName: string;
  arenaCity: string;
  homeTeam: ScheduleTeamDto;
  awayTeam: ScheduleTeamDto;
}

export interface ScheduleDto {
  /** Anno di inizio e di fine: "2026-27". */
  leagueSchedule: { seasonYear: string; gameDates: { games: ScheduleGameDto[] }[] };
}

export interface ScoreboardGameDto {
  gameId: string;
  gameStatus: number;
  homeTeam: { score: number };
  awayTeam: { score: number };
}

export interface ScoreboardDto {
  scoreboard: { games: ScoreboardGameDto[] };
}

/** Statistiche di un giocatore o di una squadra; `minutes` è una durata ISO ("PT33M15.00S"). */
export interface StatisticsDto {
  minutes: string;
  points: number;
  foulsPersonal: number;
  foulsDrawn: number;
  twoPointersMade: number;
  twoPointersAttempted: number;
  threePointersMade: number;
  threePointersAttempted: number;
  freeThrowsMade: number;
  freeThrowsAttempted: number;
  reboundsOffensive: number;
  reboundsDefensive: number;
  reboundsTotal: number;
  assists: number;
  steals: number;
  turnovers: number;
  blocks: number;
  blocksReceived: number;
  plusMinusPoints?: number;
  /** Solo nei totali di squadra: includono le palle perse "di squadra". */
  turnoversTotal?: number;
}

export interface BoxScorePlayerDto {
  personId: number;
  firstName: string;
  familyName: string;
  jerseyNum: string;
  starter: string;
  statistics: StatisticsDto;
}

export interface BoxScoreTeamDto {
  players: BoxScorePlayerDto[];
  statistics: StatisticsDto;
}

export interface BoxScoreDto {
  game: { homeTeam: BoxScoreTeamDto; awayTeam: BoxScoreTeamDto };
}

/** `playerindex`: una riga per giocatore, colonne in `headers`. */
export interface PlayerIndexDto {
  resultSets: { headers: string[]; rowSet: (string | number | null)[][] }[];
}
