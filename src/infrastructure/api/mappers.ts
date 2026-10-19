import {
  Coach,
  GameLogEntry,
  Match,
  MatchStatus,
  Player,
  PlayerProfile,
  Roster,
  StatLine,
  Standing,
  TeamRef,
} from '../../domain/entities';
import {
  CoachDto,
  GameLogRowDto,
  MatchDto,
  PlayerDto,
  RosterPlayerDto,
  RosterResponseDto,
  StandingDto,
  StatRowDto,
} from './dto';

export const CDN_URL = 'https://lba-media.s3.eu-south-1.amazonaws.com';

export function imageUrl(key: string | null | undefined): string | null {
  return key ? `${CDN_URL}/${key}` : null;
}

const n = (value: number | null | undefined): number => value ?? 0;

export function toTeamRef(id: number, name: string, code: string, logoKey: string | null): TeamRef {
  return { id, name, code, logoUrl: imageUrl(logoKey) };
}

export function toStanding(dto: StandingDto): Standing {
  return {
    position: dto.position,
    team: toTeamRef(dto.team_id, dto.team_name, dto.club_code, dto.logo_key),
    played: dto.game_played,
    wins: dto.wins,
    losses: dto.defeats,
    points: dto.points,
    pointsFor: dto.points_made,
    pointsAgainst: dto.points_suffered,
    avgPointsFor: dto.avg_points_made,
    avgPointsAgainst: dto.avg_points_suffered,
    playoffQualified: dto.play_off_qualified,
    relegation: dto.relegation,
    movement: dto.movement,
  };
}

function toMatchStatus(gameStatus: string): MatchStatus {
  if (gameStatus === '2') return 'finished';
  if (gameStatus === '1') return 'live';
  return 'scheduled';
}

export function toMatch(dto: MatchDto): Match {
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

export function toRosterPlayer(dto: RosterPlayerDto, team: TeamRef): Player {
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

export function toPlayer(dto: PlayerDto): Player {
  return {
    id: dto.id,
    firstName: dto.name,
    lastName: dto.surname,
    number: dto.player_number ?? '-',
    role: dto.player_role_description ?? '',
    country: dto.player_country_name ?? '',
    birthDate: dto.birth_date,
    birthPlace: dto.place_of_birth,
    heightCm: dto.height,
    weightKg: dto.weight,
    photoUrl: imageUrl(dto.photo_picture_key),
    teamId: dto.team_id,
    teamName: dto.team_name,
  };
}

export function toStatLine(row: StatRowDto | undefined | null): StatLine | null {
  if (!row) return null;
  const off = n(row.offensive_rebound);
  const def = n(row.defensive_rebound);
  return {
    points: n(row.points),
    minutes: n(row.played_minutes),
    matches: n(row.played_matches),
    twoMade: n(row.shots_2p_realized),
    twoAttempted: n(row.shots_2p_total),
    threeMade: n(row.shots_3p_realized),
    threeAttempted: n(row.shots_3p_total),
    freeThrowsMade: n(row.free_throws_realized),
    freeThrowsAttempted: n(row.free_throws_total),
    offensiveRebounds: off,
    defensiveRebounds: def,
    totalRebounds: row.total_rebound ?? off + def,
    assists: n(row.assists),
    steals: n(row.regain_balls),
    turnovers: n(row.lost_balls),
    blocks: n(row.ball_stop_given),
    fouls: n(row.done_fouls),
    rating: n(row.rating_lega),
  };
}

export function toGameLogEntry(row: GameLogRowDto): GameLogEntry {
  const isHome = row.player_team_id === row.home_team_id;
  const teamScore = isHome ? row.home_score : row.visitor_score;
  const opponentScore = isHome ? row.visitor_score : row.home_score;
  return {
    matchId: row.championship_match_id,
    date: new Date(row.match_date),
    opponentName: isHome ? row.visitor_team_name : row.home_team_name,
    opponentLogoUrl: imageUrl(isHome ? row.visitor_team_logo_key : row.home_team_logo_key),
    isHome,
    teamScore,
    opponentScore,
    won: teamScore > opponentScore,
    line: { ...(toStatLine(row) as StatLine), matches: 1 },
  };
}

export function toPlayerProfile(
  player: PlayerDto,
  stats: { avg?: StatRowDto[] | null; max?: StatRowDto[] | null; sum?: StatRowDto[] | null } | null,
  gameLog: GameLogRowDto[],
  seasonYear: number,
): PlayerProfile {
  return {
    player: toPlayer(player),
    seasonYear,
    averages: toStatLine(stats?.avg?.[0]),
    highs: toStatLine(stats?.max?.[0]),
    totals: toStatLine(stats?.sum?.[0]),
    gameLog: gameLog
      .map(toGameLogEntry)
      .sort((a, b) => b.date.getTime() - a.date.getTime()),
  };
}
