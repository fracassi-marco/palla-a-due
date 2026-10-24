import { Match, MatchStatus, Player, StatLine, TeamRef } from '../../domain/entities';

/** Colonne di `GAME_STATS_FIELDS` così come tornano dalle query. */
export interface GameStatsRow {
  minutes: number;
  points: number;
  fouls: number;
  fouls_drawn: number;
  two_made: number;
  two_attempted: number;
  three_made: number;
  three_attempted: number;
  free_throws_made: number;
  free_throws_attempted: number;
  offensive_rebounds: number;
  defensive_rebounds: number;
  total_rebounds: number;
  assists: number;
  steals: number;
  turnovers: number;
  blocks: number;
  blocks_against: number;
  rating: number;
}

/** `matches` è il numero di partite che la riga rappresenta (1 per una singola partita). */
export function toStatLine(row: GameStatsRow, matches = 1): StatLine {
  return {
    points: row.points,
    minutes: row.minutes,
    matches,
    twoMade: row.two_made,
    twoAttempted: row.two_attempted,
    threeMade: row.three_made,
    threeAttempted: row.three_attempted,
    freeThrowsMade: row.free_throws_made,
    freeThrowsAttempted: row.free_throws_attempted,
    offensiveRebounds: row.offensive_rebounds,
    defensiveRebounds: row.defensive_rebounds,
    totalRebounds: row.total_rebounds,
    assists: row.assists,
    steals: row.steals,
    turnovers: row.turnovers,
    blocks: row.blocks,
    fouls: row.fouls,
    rating: row.rating,
  };
}

export interface TeamRow {
  id: number;
  name: string;
  code: string;
  logo_url: string | null;
}

export const toTeamRef = (row: TeamRow): TeamRef => ({
  id: row.id,
  name: row.name,
  code: row.code,
  logoUrl: row.logo_url,
});

export interface PlayerRow {
  id: number;
  first_name: string;
  last_name: string;
  number: string;
  role: string;
  country: string;
  birth_date: string | null;
  birth_place: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  photo_url: string | null;
  team_id: number | null;
  team_name: string | null;
}

export const toPlayer = (row: PlayerRow): Player => ({
  id: row.id,
  firstName: row.first_name,
  lastName: row.last_name,
  number: row.number,
  role: row.role,
  country: row.country,
  birthDate: row.birth_date,
  birthPlace: row.birth_place,
  heightCm: row.height_cm,
  weightKg: row.weight_kg,
  photoUrl: row.photo_url,
  teamId: row.team_id ?? 0,
  teamName: row.team_name ?? '',
});

/** SELECT di una partita con le due squadre, da completare con WHERE e ORDER BY. */
export const MATCH_SELECT = `
  SELECT m.id, m.status, m.starts_at, m.day_number, m.day_name, m.home_score, m.away_score,
         m.venue, m.city, m.has_streaming, m.live_label,
         h.id AS h_id, h.name AS h_name, h.code AS h_code, h.logo_url AS h_logo,
         a.id AS a_id, a.name AS a_name, a.code AS a_code, a.logo_url AS a_logo
  FROM matches m
  JOIN teams h ON h.id = m.home_team_id
  JOIN teams a ON a.id = m.away_team_id`;

export interface MatchRow {
  id: number;
  status: MatchStatus;
  starts_at: number;
  day_number: number;
  day_name: string;
  home_score: number | null;
  away_score: number | null;
  venue: string | null;
  city: string | null;
  has_streaming: number;
  live_label: string | null;
  h_id: number;
  h_name: string;
  h_code: string;
  h_logo: string | null;
  a_id: number;
  a_name: string;
  a_code: string;
  a_logo: string | null;
}

export const toMatch = (row: MatchRow): Match => ({
  id: row.id,
  status: row.status,
  startsAt: new Date(row.starts_at),
  home: { id: row.h_id, name: row.h_name, code: row.h_code, logoUrl: row.h_logo },
  away: { id: row.a_id, name: row.a_name, code: row.a_code, logoUrl: row.a_logo },
  homeScore: row.home_score,
  awayScore: row.away_score,
  venue: row.venue,
  city: row.city,
  dayNumber: row.day_number,
  dayName: row.day_name,
  hasStreaming: row.has_streaming === 1,
  liveLabel: row.live_label,
});

/** Squadre che hanno giocato (o giocheranno) nella competizione; due segnaposto `?` con lo stesso id. */
export const COMPETITION_TEAM_IDS = `
  SELECT home_team_id FROM matches WHERE competition_id = ?
  UNION
  SELECT away_team_id FROM matches WHERE competition_id = ?`;
