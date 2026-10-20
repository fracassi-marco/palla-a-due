/** Forma dei dati di `api-live.euroleague.net` (solo i campi letti dall'app). */
export interface ClubDto {
  code: string;
  name: string;
  abbreviatedName: string;
  tvCode: string;
  images: { crest?: string | null };
}

export interface GameSideDto {
  club: ClubDto;
  score: number;
}

export interface GameDto {
  gameCode: number;
  phaseType: { code: string };
  group: { order: number; rawName: string };
  round: number;
  played: boolean;
  utcDate: string;
  local: GameSideDto;
  road: GameSideDto;
  venue: { name: string } | null;
}

export interface GamesResponseDto {
  data: GameDto[];
}

export interface PersonDto {
  code: string;
  name: string;
  country: { name: string } | null;
  height: number;
  weight: number;
  birthDate: string | null;
}

export interface PersonRoleDto {
  person: PersonDto;
  /** "J" giocatore, "E" allenatore; gli altri ruoli (assistenti, staff) non servono. */
  type: string;
  active: boolean;
  dorsal: string | null;
  positionName: string | null;
  images: { headshot?: string | null };
}

export interface PlayerStatsDto {
  timePlayed: number;
  valuation: number;
  points: number;
  fieldGoalsMade2: number;
  fieldGoalsAttempted2: number;
  fieldGoalsMade3: number;
  fieldGoalsAttempted3: number;
  freeThrowsMade: number;
  freeThrowsAttempted: number;
  totalRebounds: number;
  defensiveRebounds: number;
  offensiveRebounds: number;
  assistances: number;
  steals: number;
  turnovers: number;
  blocksFavour: number;
  blocksAgainst: number;
  foulsCommited: number;
  foulsReceived: number;
  plusMinus: number;
  dorsal?: number;
  startFive?: boolean;
}

export interface BoxScorePlayerDto {
  player: PersonRoleDto;
  stats: PlayerStatsDto;
}

export interface BoxScoreSideDto {
  players: BoxScorePlayerDto[];
  total: PlayerStatsDto | null;
}

/** Prima della palla a due i due lati hanno `players` vuoto e `total` nullo. */
export interface BoxScoreResponseDto {
  local: BoxScoreSideDto;
  road: BoxScoreSideDto;
}
