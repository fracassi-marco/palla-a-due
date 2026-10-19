export interface CompetitionDto {
  id: number;
  year: number;
  name: string;
  status: number;
  ctype_code: string;
  cserie_code: string;
  focus_on: boolean;
}

export interface CompetitionsResponseDto {
  competitions: CompetitionDto[];
}

export interface MatchDto {
  id: number;
  game_status: string;
  match_datetime: string;
  home_final_score: number | null;
  visitor_final_score: number | null;
  has_streaming: number;
  h_team_id: number;
  h_team_name: string;
  h_club_code: string;
  home_logo_key: string | null;
  v_team_id: number;
  v_team_name: string;
  v_club_code: string;
  v_logo_key: string | null;
  plant_name: string | null;
  town_name: string | null;
  day_serial: number;
  day_name: string;
}

export interface CalendarResponseDto {
  matches: MatchDto[] | null;
  cdn_url: string;
}

export interface TeamDto {
  id: number;
  name: string;
  club_code: string;
  logo_key: string | null;
}

export interface RosterPlayerDto {
  id: number;
  name: string;
  surname: string;
  player_number: string | null;
  country: string | null;
  birth_date: string | null;
  place_of_birth: string | null;
  height: number | null;
  weight: number | null;
  player_role: string | null;
  team_name: string;
  player_picture_key: string | null;
}

export interface CoachDto {
  id: number;
  name: string;
  surname: string;
  coach_picture_key: string | null;
}

export interface RosterResponseDto {
  team: TeamDto;
  coach: CoachDto | null;
  players: RosterPlayerDto[] | null;
  cdn_url: string;
}

/** Statistiche di una partita: stessi campi per la riga di un giocatore e per i totali di squadra. */
export interface BoxScoreStatsDto {
  min: number | null;
  pun: number | null;
  falli_c: number | null;
  falli_sf: number | null;
  t2_r: number | null;
  t2_t: number | null;
  t3_r: number | null;
  t3_t: number | null;
  tl_r: number | null;
  tl_t: number | null;
  rimbalzi_o: number | null;
  rimbalzi_d: number | null;
  rimbalzi_t: number | null;
  stoppate_dat: number | null;
  stoppate_sub: number | null;
  palle_p: number | null;
  palle_r: number | null;
  ass: number | null;
  val_lega: number | null;
}

export interface BoxScoreRowDto extends BoxScoreStatsDto {
  player_id: number;
  player_num: number | string | null;
  player_name: string;
  player_surname: string;
  player_p_key: string | null;
  /** "1" se in quintetto base. */
  sf: string | number | null;
  plus_minus: number | null;
}

export interface BoxScoreSideDto {
  rows: BoxScoreRowDto[] | null;
  totals: BoxScoreStatsDto | null;
}

export interface BoxScoreResponseDto {
  scores: {
    ht: BoxScoreSideDto | null;
    vt: BoxScoreSideDto | null;
  } | null;
}
