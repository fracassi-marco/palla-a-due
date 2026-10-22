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

/** Forma dei dati di `live.euroleague.net/api` (non documentata, ma è quella che alimenta il sito): i numeri sono spesso stringhe. */
export interface LiveHeaderDto {
  Live: boolean;
  /** Squadra di casa (`local` nell'API v2). */
  ScoreA: string;
  ScoreB: string;
}

export interface LivePlayerDto {
  /** "P014920   ": il codice persona è preceduto da "P" e riempito di spazi. */
  Player_ID: string;
  IsStarter: number;
  Dorsal: string;
  Player: string;
  /** "24:22" */
  Minutes: string;
  Points: number;
  FieldGoalsMade2: number;
  FieldGoalsAttempted2: number;
  FieldGoalsMade3: number;
  FieldGoalsAttempted3: number;
  FreeThrowsMade: number;
  FreeThrowsAttempted: number;
  OffensiveRebounds: number;
  DefensiveRebounds: number;
  TotalRebounds: number;
  Assistances: number;
  Steals: number;
  Turnovers: number;
  BlocksFavour: number;
  BlocksAgainst: number;
  FoulsCommited: number;
  FoulsReceived: number;
  Valuation: number;
  Plusminus: number;
}

export interface LiveBoxScoreDto {
  /** Squadra di casa, poi ospiti. */
  Stats: { PlayersStats: LivePlayerDto[]; totr: Omit<LivePlayerDto, 'Player_ID' | 'IsStarter' | 'Dorsal' | 'Player'> }[];
}
