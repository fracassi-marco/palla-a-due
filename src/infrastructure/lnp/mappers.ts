import { Match, MatchStatus, TeamRef } from '../../domain/entities';
import { gameNumber, matchId } from './ids';
import { ScheduleGameDto } from './dto';

export const SITE_URL = 'https://www.legapallacanestro.com';

/** Parole che non identificano la squadra: sponsor generici e nomi della società. */
const NOT_A_PLACE = new Set(['basket', 'basketball', 'pallacanestro', 'club', 'team']);

/** LNP non ha sigle: ne ricaviamo una dall'ultima parola significativa del nome (di solito la città). */
function teamCode(name: string): string {
  const words = name.split(/\s+/).filter((w) => /[a-zà-ÿ]/i.test(w) && !NOT_A_PLACE.has(w.toLowerCase()));
  const word = words[words.length - 1] ?? name;
  return word.slice(0, 3).toUpperCase();
}

export function toTeamRef(id: number, name: string, logoExtension = 'png'): TeamRef {
  return {
    id,
    name,
    code: teamCode(name),
    logoUrl: `${SITE_URL}/sites/default/files/styles/255_x/public/team_logo/${id}.${logoExtension}`,
  };
}

/** Estensione del logo di ogni squadra, quando nota. */
export type LogoExtensions = ReadonlyMap<number, { logoExtension: string }>;

function toStatus(gameStatus: string): MatchStatus {
  if (gameStatus === 'finished') return 'finished';
  // Il sito distingue solo "finished" e il resto; prima della palla a due lo stato è "ready".
  return gameStatus === 'ready' ? 'scheduled' : 'live';
}

const HOUR = 60 * 60 * 1000;

/** Ultima domenica del mese (0-based), a mezzanotte UTC. */
function lastSundayUtc(year: number, month: number): number {
  const last = new Date(Date.UTC(year, month + 1, 0));
  return last.getTime() - last.getUTCDay() * 24 * HOUR;
}

/** Data e ora italiane ("26/09/2026", "20:30") → istante, tenendo conto dell'ora legale (UTC+2 da fine marzo a fine ottobre). */
export function romeToDate(date: string, time: string | null): Date | null {
  const d = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(date);
  if (!d) return null;
  const t = /^(\d{1,2}):(\d{2})/.exec(time ?? '');
  const [day, month, year] = [Number(d[1]), Number(d[2]), Number(d[3])];
  const wallClock = Date.UTC(year, month - 1, day, t ? Number(t[1]) : 0, t ? Number(t[2]) : 0);
  const summer = wallClock - 2 * HOUR;
  const dstStart = lastSundayUtc(year, 2) + HOUR;
  const dstEnd = lastSundayUtc(year, 9) + HOUR;
  return new Date(summer >= dstStart && summer < dstEnd ? summer : wallClock - HOUR);
}

const toScore = (value: string | null | undefined) => {
  const n = value === null || value === undefined || value === '' ? NaN : Number(value);
  return Number.isNaN(n) ? null : n;
};

/** Null se la partita non ha ancora una data (rinviata senza nuova data). */
export function toMatch(dto: ScheduleGameDto, competition: number, logos: LogoExtensions): Match | null {
  const startsAt = dto.date ? romeToDate(dto.date, dto.time) : null;
  if (!startsAt) return null;
  const status = toStatus(dto.game_status);
  const played = status !== 'scheduled';
  const dayNumber = Number(dto.round);
  return {
    id: matchId(competition, gameNumber(dto.gameid)),
    status,
    startsAt,
    home: toTeamRef(Number(dto.teamid_home), dto.teamname_home, logos.get(Number(dto.teamid_home))?.logoExtension),
    away: toTeamRef(Number(dto.teamid_away), dto.teamname_away, logos.get(Number(dto.teamid_away))?.logoExtension),
    homeScore: played ? toScore(dto.score_home) : null,
    awayScore: played ? toScore(dto.score_away) : null,
    venue: dto.arena || null,
    city: null,
    dayNumber,
    dayName: `Giornata ${dayNumber}`,
    hasStreaming: Boolean(dto.stream_url),
  };
}
