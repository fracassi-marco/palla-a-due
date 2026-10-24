import { liveLabel } from '../../domain/liveLabel';
import {
  BoxScorePlayer,
  BoxScoreSide,
  Coach,
  GameStats,
  Match,
  MatchBoxScore,
  MatchStatus,
  Player,
  Roster,
  TeamRef,
} from '../../domain/entities';
import {
  BoxScoreResponseDto,
  BoxScoreRowDto,
  BoxScoreSideDto,
  BoxScoreStatsDto,
  CoachDto,
  MatchDto,
  RosterPlayerDto,
  RosterResponseDto,
} from './dto';

export const CDN_URL = 'https://lba-media.s3.eu-south-1.amazonaws.com';

export function imageUrl(key: string | null | undefined): string | null {
  return key ? `${CDN_URL}/${key}` : null;
}

const n = (value: number | null | undefined): number => value ?? 0;

export function toTeamRef(id: number, name: string, code: string, logoKey: string | null): TeamRef {
  return { id, name, code, logoUrl: imageUrl(logoKey) };
}

function toMatchStatus(gameStatus: string): MatchStatus {
  if (gameStatus === '2') return 'finished';
  if (gameStatus === '1') return 'live';
  return 'scheduled';
}

export function toMatch(dto: MatchDto, quarter: number | null = null): Match {
  return {
    id: dto.id,
    status: toMatchStatus(dto.game_status),
    startsAt: new Date(dto.match_datetime),
    home: toTeamRef(dto.h_team_id, dto.h_team_name, dto.h_club_code, dto.home_logo_key),
    away: toTeamRef(dto.v_team_id, dto.v_team_name, dto.v_club_code, dto.v_logo_key),
    homeScore: dto.home_final_score,
    awayScore: dto.visitor_final_score,
    venue: dto.plant_name || null,
    city: dto.town_name || null,
    dayNumber: dto.day_serial,
    dayName: dto.day_name,
    hasStreaming: dto.has_streaming === 1,
    liveLabel: quarter === null ? null : liveLabel(quarter, null),
  };
}

function toCoach(dto: CoachDto): Coach {
  return {
    id: dto.id,
    firstName: dto.name,
    lastName: dto.surname,
    photoUrl: imageUrl(dto.coach_picture_key),
  };
}

function toRosterPlayer(dto: RosterPlayerDto, team: TeamRef): Player {
  return {
    id: dto.id,
    firstName: dto.name,
    lastName: dto.surname,
    number: dto.player_number ?? '-',
    role: dto.player_role ?? '',
    country: dto.country ?? '',
    birthDate: dto.birth_date,
    birthPlace: dto.place_of_birth,
    heightCm: dto.height,
    weightKg: dto.weight,
    photoUrl: imageUrl(dto.player_picture_key),
    teamId: team.id,
    teamName: dto.team_name,
  };
}

export function toRoster(dto: RosterResponseDto): Roster {
  const team = toTeamRef(dto.team.id, dto.team.name, dto.team.club_code, dto.team.logo_key);
  return {
    team,
    coach: dto.coach ? toCoach(dto.coach) : null,
    players: (dto.players ?? []).map((p) => toRosterPlayer(p, team)),
  };
}

function toGameStats(dto: BoxScoreStatsDto): GameStats {
  const off = n(dto.rimbalzi_o);
  const def = n(dto.rimbalzi_d);
  return {
    minutes: n(dto.min),
    points: n(dto.pun),
    fouls: n(dto.falli_c),
    foulsDrawn: n(dto.falli_sf),
    twoMade: n(dto.t2_r),
    twoAttempted: n(dto.t2_t),
    threeMade: n(dto.t3_r),
    threeAttempted: n(dto.t3_t),
    freeThrowsMade: n(dto.tl_r),
    freeThrowsAttempted: n(dto.tl_t),
    offensiveRebounds: off,
    defensiveRebounds: def,
    totalRebounds: dto.rimbalzi_t ?? off + def,
    assists: n(dto.ass),
    steals: n(dto.palle_r),
    turnovers: n(dto.palle_p),
    blocks: n(dto.stoppate_dat),
    blocksAgainst: n(dto.stoppate_sub),
    rating: n(dto.val_lega),
  };
}

function toBoxScorePlayer(row: BoxScoreRowDto): BoxScorePlayer {
  return {
    id: row.player_id,
    firstName: row.player_name,
    lastName: row.player_surname,
    number: row.player_num === null || row.player_num === undefined ? '-' : String(row.player_num),
    photoUrl: imageUrl(row.player_p_key),
    starter: String(row.sf) === '1',
    plusMinus: n(row.plus_minus),
    stats: toGameStats(row),
  };
}

function toBoxScoreSide(dto: BoxScoreSideDto | null | undefined): BoxScoreSide {
  return {
    players: (dto?.rows ?? []).map(toBoxScorePlayer),
    totals: toGameStats(dto?.totals ?? ({} as BoxScoreStatsDto)),
  };
}

export function toMatchBoxScore(dto: BoxScoreResponseDto): MatchBoxScore {
  return { home: toBoxScoreSide(dto.scores?.ht), away: toBoxScoreSide(dto.scores?.vt) };
}
