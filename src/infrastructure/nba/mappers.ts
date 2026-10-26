import { liveLabel } from '../../domain/liveLabel';
import { BoxScorePlayer, BoxScoreSide, GameStats, Match, MatchStatus, Player, TeamRef } from '../../domain/entities';
import { BoxScorePlayerDto, BoxScoreTeamDto, ScheduleGameDto, StatisticsDto } from './dto';
import { matchId } from './ids';
import { logoUrl, NbaTeam } from './teams';
import { weekOf } from './weeks';

const CM_PER_INCH = 2.54;
const KG_PER_POUND = 0.45359237;

export const toTeamRef = (team: NbaTeam): TeamRef => ({ id: team.id, name: team.name, code: team.code, logoUrl: logoUrl(team) });

export const STATUSES: Record<number, MatchStatus> = { 1: 'scheduled', 2: 'live', 3: 'finished' };

/** `date` è AAAAMMGG (ora della costa Est). Il punteggio c'è solo a partita iniziata. */
export function toMatch(
  competition: number,
  seasonYear: number,
  date: string,
  home: NbaTeam,
  away: NbaTeam,
  status: MatchStatus,
  startsAt: Date,
  score: { home: number; away: number },
  venue: { name: string; city: string } | null,
  live: { period: number; clock: string } | null = null,
): Match {
  const week = weekOf(seasonYear, date);
  const started = status !== 'scheduled';
  return {
    id: matchId(date, home, away),
    status,
    startsAt,
    home: toTeamRef(home),
    away: toTeamRef(away),
    homeScore: started ? score.home : null,
    awayScore: started ? score.away : null,
    venue: venue?.name || null,
    city: venue?.city || null,
    dayNumber: week,
    dayName: `Settimana ${week}`,
    hasStreaming: false,
    liveLabel: status === 'live' && live ? liveLabel(live.period, clockSeconds(live.clock)) : null,
  };
}

/** "PT05M32.00S" → 332 secondi; vuoto (tra un periodo e l'altro) → 0. */
export function clockSeconds(duration: string): number {
  const match = /^PT(?:(\d+)M)?(\d+(?:\.\d+)?)S$/.exec(duration);
  return match ? Number(match[1] ?? 0) * 60 + Number(match[2]) : 0;
}

export const gameDate = (game: ScheduleGameDto) => game.gameCode.slice(0, 8);

/** "PT33M15.00S" → 33 (minuti interi, come nelle altre fonti). */
export const minutesOf = (duration: string) => Number.parseInt(/^PT(\d+)M/.exec(duration)?.[1] ?? '0', 10);

/**
 * Valutazione come la EuroLeague (PIR): punti + rimbalzi + assist + recuperi + stoppate + falli subiti
 * − tiri sbagliati (dal campo e liberi) − palle perse − falli fatti − stoppate subite. La NBA non ne pubblica una.
 */
function performanceIndex(s: StatisticsDto, turnovers: number): number {
  const fieldGoalMisses = s.twoPointersAttempted + s.threePointersAttempted - s.twoPointersMade - s.threePointersMade;
  return (
    s.points + s.reboundsTotal + s.assists + s.steals + s.blocks + s.foulsDrawn -
    fieldGoalMisses - (s.freeThrowsAttempted - s.freeThrowsMade) - turnovers - s.foulsPersonal - s.blocksReceived
  );
}

function toGameStats(s: StatisticsDto): GameStats {
  const turnovers = s.turnoversTotal ?? s.turnovers;
  return {
    minutes: minutesOf(s.minutes),
    points: s.points,
    fouls: s.foulsPersonal,
    foulsDrawn: s.foulsDrawn,
    twoMade: s.twoPointersMade,
    twoAttempted: s.twoPointersAttempted,
    threeMade: s.threePointersMade,
    threeAttempted: s.threePointersAttempted,
    freeThrowsMade: s.freeThrowsMade,
    freeThrowsAttempted: s.freeThrowsAttempted,
    offensiveRebounds: s.reboundsOffensive,
    defensiveRebounds: s.reboundsDefensive,
    totalRebounds: s.reboundsTotal,
    assists: s.assists,
    steals: s.steals,
    turnovers,
    blocks: s.blocks,
    blocksAgainst: s.blocksReceived,
    rating: performanceIndex(s, turnovers),
  };
}

export const headshotUrl = (personId: number) => `https://cdn.nba.com/headshots/nba/latest/260x190/${personId}.png`;

function toBoxScorePlayer(p: BoxScorePlayerDto, photoUrl: (personId: number) => string): BoxScorePlayer {
  return {
    id: p.personId,
    firstName: p.firstName,
    lastName: p.familyName,
    number: p.jerseyNum || '-',
    photoUrl: photoUrl(p.personId),
    starter: p.starter === '1',
    plusMinus: p.statistics.plusMinusPoints ?? 0,
    stats: toGameStats(p.statistics),
  };
}

/** `photoUrl`: la WNBA, che ha lo stesso formato di dati, ha le foto su un altro percorso. */
export function toBoxScoreSide(team: BoxScoreTeamDto, photoUrl = headshotUrl): BoxScoreSide {
  return { players: team.players.map((p) => toBoxScorePlayer(p, photoUrl)), totals: toGameStats(team.statistics) };
}

const ROLES: Record<string, string> = { G: 'Guardia', F: 'Ala', C: 'Centro' };

/** "G-F" → "Guardia/Ala". */
const role = (position: string) => position.split('-').map((p) => ROLES[p] ?? p).join('/');

/** "6-8" (piedi-pollici) → 203. */
function heightCm(height: string | null): number | null {
  const [feet, inches] = (height ?? '').split('-').map(Number);
  return Number.isFinite(feet) && Number.isFinite(inches) ? Math.round((feet * 12 + inches) * CM_PER_INCH) : null;
}

const weightKg = (pounds: string | null) => (Number(pounds) > 0 ? Math.round(Number(pounds) * KG_PER_POUND) : null);

/** Riga di `playerindex` (colonne in `headers`) → giocatore della squadra. */
export function toPlayer(row: Record<string, string | number | null>, team: TeamRef, photoUrl = headshotUrl): Player {
  const id = Number(row.PERSON_ID);
  return {
    id,
    firstName: String(row.PLAYER_FIRST_NAME ?? ''),
    lastName: String(row.PLAYER_LAST_NAME ?? ''),
    number: row.JERSEY_NUMBER ? String(row.JERSEY_NUMBER) : '-',
    role: role(String(row.POSITION ?? '')),
    country: String(row.COUNTRY ?? ''),
    birthDate: null,
    birthPlace: null,
    heightCm: heightCm(row.HEIGHT as string | null),
    weightKg: weightKg(row.WEIGHT as string | null),
    photoUrl: photoUrl(id),
    teamId: team.id,
    teamName: team.name,
  };
}
