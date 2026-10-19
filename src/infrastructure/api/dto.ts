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

export interface StandingDto {
  position: number;
  team_id: number;
  team_name: string;
  club_code: string;
  logo_key: string | null;
  wins: number;
  defeats: number;
  points: number;
  points_made: number;
  points_suffered: number;
  game_played: number;
  avg_points_made: number;
  avg_points_suffered: number;
  play_off_qualified: boolean;
  relegation: boolean;
  movement: string | null;
}

export interface StandingsResponseDto {
  standings: StandingDto[] | null;
  cdn_url: string;
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

export interface PlayerDto {
  id: number;
  name: string;
  surname: string;
  place_of_birth: string | null;
  birth_date: string | null;
  photo_picture_key: string | null;
  player_number: string | null;
  height: number | null;
  weight: number | null;
  team_id: number;
  team_name: string;
  player_role_description: string | null;
  player_country_name: string | null;
}

/** Riga statistiche aggregata (media/massimo/totale). */
export interface StatRowDto {
  points: number | null;
  played_minutes: number | null;
  played_matches: number | null;
  done_fouls: number | null;
  shots_2p_realized: number | null;
  shots_2p_total: number | null;
  shots_3p_realized: number | null;
  shots_3p_total: number | null;
  free_throws_realized: number | null;
  free_throws_total: number | null;
  offensive_rebound: number | null;
  defensive_rebound: number | null;
  total_rebound?: number | null;
  ball_stop_given: number | null;
  lost_balls: number | null;
  regain_balls: number | null;
  assists: number | null;
  rating_lega: number | null;
}

export interface PlayerStatsResponseDto {
  player: PlayerDto;
  stats: {
    data: {
      avg: StatRowDto[] | null;
      max: StatRowDto[] | null;
      sum: StatRowDto[] | null;
    };
  } | null;
}

export interface GameLogRowDto extends StatRowDto {
  championship_match_id: number;
  match_date: string;
  player_team_id: number;
  home_team_id: number;
  home_team_name: string;
  home_team_logo_key: string | null;
  visitor_team_name: string;
  visitor_team_logo_key: string | null;
  home_score: number;
  visitor_score: number;
}

export interface GameLogResponseDto {
  matches_stats: { data: GameLogRowDto[] | null } | null;
}

export interface BoxScoreRowDto {
  player_id: number;
  pun: number | null;
  min: number | null;
  falli_c: number | null;
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
  palle_p: number | null;
  palle_r: number | null;
  ass: number | null;
  val_lega: number | null;
}

export interface BoxScoreResponseDto {
  scores: {
    ht: { rows: BoxScoreRowDto[] | null } | null;
    vt: { rows: BoxScoreRowDto[] | null } | null;
  } | null;
}
