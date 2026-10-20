import { BoxScorePlayer, BoxScoreSide, Coach, GameStats, Match, MatchStatus, Player, TeamRef } from '../../domain/entities';
import { BoxScoreSideDto, ClubDto, GameDto, PersonRoleDto, PlayerStatsDto } from './dto';
import { clubId, matchId, personId } from './ids';

const HOUR = 60 * 60 * 1000;
/** L'API non ha uno stato "in corso": una partita non ancora segnata come giocata e iniziata da meno di questo tempo lo è. */
const LIVE_WINDOW_MS = 3 * HOUR;

/** "OLEK BALCEROWSKI" → "Olek Balcerowski", mantenendo trattini e apostrofi. */
export const titleCase = (value: string) => value.toLowerCase().replace(/(^|[\s\-'])(\p{L})/gu, (_, sep: string, c: string) => sep + c.toUpperCase());

/** L'API scrive "COGNOME, NOME". */
export function splitName(full: string): { firstName: string; lastName: string } {
  const [last, ...first] = full.split(',');
  return { firstName: titleCase(first.join(',').trim()), lastName: titleCase(last.trim()) };
}

export function toTeamRef(club: ClubDto): TeamRef {
  return {
    id: clubId(club.code),
    name: club.abbreviatedName.trim() || club.name,
    code: club.tvCode || club.code,
    logoUrl: club.images.crest ?? null,
  };
}

function toStatus(dto: GameDto, now: number, startsAt: number): MatchStatus {
  if (dto.played) return 'finished';
  return now >= startsAt && now < startsAt + LIVE_WINDOW_MS ? 'live' : 'scheduled';
}

export function toMatch(dto: GameDto, competition: number, now: number): Match {
  const startsAt = new Date(dto.utcDate);
  const status = toStatus(dto, now, startsAt.getTime());
  const started = status !== 'scheduled';
  return {
    id: matchId(competition, dto.gameCode),
    status,
    startsAt,
    home: toTeamRef(dto.local.club),
    away: toTeamRef(dto.road.club),
    homeScore: started ? dto.local.score : null,
    awayScore: started ? dto.road.score : null,
    venue: dto.venue?.name ? titleCase(dto.venue.name) : null,
    city: null,
    dayNumber: dto.round,
    dayName: `Giornata ${dto.round}`,
    hasStreaming: false,
  };
}

const ROLES: Record<string, string> = { Guard: 'Guardia', Forward: 'Ala', Center: 'Centro' };

export function toPlayer(role: PersonRoleDto, team: TeamRef): Player {
  const { person } = role;
  return {
    id: personId(person.code),
    ...splitName(person.name),
    number: role.dorsal || '-',
    role: (role.positionName && ROLES[role.positionName]) || role.positionName || '',
    country: person.country?.name ?? '',
    birthDate: person.birthDate?.slice(0, 10) ?? null,
    birthPlace: null,
    heightCm: person.height || null,
    weightKg: person.weight || null,
    photoUrl: role.images.headshot ?? null,
    teamId: team.id,
    teamName: team.name,
  };
}

export function toCoach(role: PersonRoleDto): Coach {
  return { id: personId(role.person.code), ...splitName(role.person.name), photoUrl: role.images.headshot ?? null };
}

const EMPTY_STATS: GameStats = {
  minutes: 0,
  points: 0,
  fouls: 0,
  foulsDrawn: 0,
  twoMade: 0,
  twoAttempted: 0,
  threeMade: 0,
  threeAttempted: 0,
  freeThrowsMade: 0,
  freeThrowsAttempted: 0,
  offensiveRebounds: 0,
  defensiveRebounds: 0,
  totalRebounds: 0,
  assists: 0,
  steals: 0,
  turnovers: 0,
  blocks: 0,
  blocksAgainst: 0,
  rating: 0,
};

/** I minuti sono interi (come nelle altre fonti): l'API dà i secondi giocati. */
function toGameStats(dto: PlayerStatsDto): GameStats {
  return {
    minutes: Math.floor(dto.timePlayed / 60),
    points: dto.points,
    fouls: dto.foulsCommited,
    foulsDrawn: dto.foulsReceived,
    twoMade: dto.fieldGoalsMade2,
    twoAttempted: dto.fieldGoalsAttempted2,
    threeMade: dto.fieldGoalsMade3,
    threeAttempted: dto.fieldGoalsAttempted3,
    freeThrowsMade: dto.freeThrowsMade,
    freeThrowsAttempted: dto.freeThrowsAttempted,
    offensiveRebounds: dto.offensiveRebounds,
    defensiveRebounds: dto.defensiveRebounds,
    totalRebounds: dto.totalRebounds,
    assists: dto.assistances,
    steals: dto.steals,
    turnovers: dto.turnovers,
    blocks: dto.blocksFavour,
    blocksAgainst: dto.blocksAgainst,
    rating: dto.valuation,
  };
}

export function toBoxScoreSide(dto: BoxScoreSideDto): BoxScoreSide {
  return {
    players: dto.players.map(({ player, stats }): BoxScorePlayer => ({
      id: personId(player.person.code),
      ...splitName(player.person.name),
      number: String(stats.dorsal ?? player.dorsal ?? '-'),
      photoUrl: player.images.headshot ?? null,
      starter: stats.startFive === true,
      plusMinus: stats.plusMinus,
      stats: toGameStats(stats),
    })),
    totals: dto.total ? toGameStats(dto.total) : EMPTY_STATS,
  };
}
