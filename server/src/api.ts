/**
 * API di lettura dei dati dei campionati: `node api.js`, in ascolto su 127.0.0.1 (davanti c'è Caddy).
 * Espone la stessa forma di `LeagueSource`: la app la usa come fonte principale (`BackendLeagueSource`).
 *
 * I dati consolidati vengono dal database scritto dai cron. Ciò che può ancora cambiare (giornate non concluse, box score
 * live o non definitivi) viene scaricato dalla sorgente con una cache breve in memoria, finché non c'è un poller live;
 * se la sorgente non risponde si serve l'ultima copia del database.
 */
import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';

import { currentSeasonYear } from '../../src/application/season';
import { createSource } from '../../src/di/createSource';
import { isLeagueId, LeagueId } from '../../src/domain/League';
import { Match } from '../../src/domain/entities';
import { LeagueSource } from '../../src/domain/ports';
import { HttpError } from '../../src/infrastructure/api/HttpClient';
import { BetterSqliteDatabase } from './BetterSqliteDatabase';
import { LeagueReader, Stored } from './LeagueReader';
import { TtlCache } from './TtlCache';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

/** Quanto resta valido ciò che si scarica dalla sorgente, in base a cosa può cambiare. */
const LIVE_TTL_MS = 15 * SECOND;
const PENDING_TTL_MS = 5 * MINUTE;
const STATIC_TTL_MS = HOUR;
const LIVE_WINDOW_BEFORE_MS = 30 * MINUTE;
const LIVE_WINDOW_AFTER_MS = 4 * HOUR;
/** Cache del client (`Cache-Control`) per i dati definitivi. */
const FINAL_MAX_AGE_S = 3600;

interface Payload<T> {
  source: 'db' | 'live';
  /** Quando il dato è stato scaricato dalla sorgente (ms). */
  updatedAt: number;
  data: T;
  /** Secondi di validità per `Cache-Control`. */
  maxAge: number;
}

class NotFound extends Error {}

interface LeagueContext {
  reader: LeagueReader;
  source: LeagueSource;
}

const dir = process.env.DATABASE_DIR ?? (process.env.NODE_ENV === 'production' ? '' : './data');
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '127.0.0.1';

const contexts = new Map<LeagueId, LeagueContext>();
const cache = new TtlCache();

function contextOf(league: LeagueId): LeagueContext {
  let context = contexts.get(league);
  if (!context) {
    const reader = new LeagueReader(new BetterSqliteDatabase(join(dir, `${league}.db`)));
    context = { reader, source: createSource(league, reader.matchRepository) };
    contexts.set(league, context);
  }
  return context;
}

const db = <T>(stored: Stored<T>, maxAge: number): Payload<T> => ({ source: 'db', updatedAt: stored.fetchedAt, data: stored.value, maxAge });

/** Scarica dalla sorgente (con cache); se non risponde, ripiega sulla copia del database, se c'è. */
async function live<T>(key: string, ttlMs: number, load: () => Promise<T>, stale: Stored<T> | null): Promise<Payload<T>> {
  try {
    const { value, at } = await cache.get(key, ttlMs, load);
    return { source: 'live', updatedAt: at, data: value, maxAge: Math.round(ttlMs / SECOND) };
  } catch (error) {
    if (!stale) throw error;
    console.warn(`[${key}] sorgente non disponibile, copia del database: ${error instanceof Error ? error.message : error}`);
    return db(stale, 0);
  }
}

async function competitions(league: LeagueId, season: number): Promise<Payload<unknown>> {
  const { reader, source } = contextOf(league);
  const stored = await reader.competitions(season);
  if (stored.length > 0) return { source: 'db', updatedAt: 0, data: stored, maxAge: FINAL_MAX_AGE_S };
  return live(`${league}:competitions:${season}`, STATIC_TTL_MS, () => source.findRegularSeasons(season), null);
}

/**
 * Una partita è in corso, o lo può essere: il database è aggiornato dai cron una volta al giorno e la dà ancora
 * "in programma" quando è già iniziata, quindi si guarda anche l'orario (ultima mezz'ora prima della palla a due, poi 4 ore).
 */
function mayBeLive(match: Match): boolean {
  if (match.status === 'live') return true;
  if (match.status === 'finished') return false;
  const sinceKickoff = Date.now() - match.startsAt.getTime();
  return sinceKickoff > -LIVE_WINDOW_BEFORE_MS && sinceKickoff < LIVE_WINDOW_AFTER_MS;
}

async function day(league: LeagueId, competitionId: number, dayNumber: number): Promise<Payload<unknown>> {
  const { reader, source } = contextOf(league);
  const stored = await reader.day(competitionId, dayNumber);
  const matches = stored?.value ?? [];
  if (matches.length > 0 && matches.every((m) => m.status === 'finished')) return db(stored!, FINAL_MAX_AGE_S);

  const ttl = matches.some(mayBeLive) ? LIVE_TTL_MS : PENDING_TTL_MS;
  return live(`${league}:day:${competitionId}:${dayNumber}`, ttl, () => source.getDay(competitionId, dayNumber), stored);
}

async function boxScore(league: LeagueId, matchId: number): Promise<Payload<unknown>> {
  const { reader, source } = contextOf(league);
  const [info, stored] = await Promise.all([reader.matchInfo(matchId), reader.boxScore(matchId)]);
  if (stored && info?.boxScoreFinal) return db(stored, FINAL_MAX_AGE_S);

  const ttl = info?.status === 'finished' ? PENDING_TTL_MS : LIVE_TTL_MS;
  return live(`${league}:box:${matchId}`, ttl, () => source.getBoxScore(matchId), stored);
}

async function roster(league: LeagueId, teamId: number): Promise<Payload<unknown>> {
  const { reader, source } = contextOf(league);
  const stored = await reader.roster(teamId);
  if (stored) return db(stored, FINAL_MAX_AGE_S);
  return live(`${league}:roster:${teamId}`, STATIC_TTL_MS, () => source.getRoster(teamId), null);
}

const ID = '(\\d+)';
const LEAGUE = '([a-z0-9]+)';

/** Percorsi dell'API: ogni voce estrae i parametri dall'URL e produce la risposta. */
const ROUTES: { pattern: RegExp; handle: (params: string[], query: URLSearchParams) => Promise<Payload<unknown>> }[] = [
  {
    pattern: new RegExp(`^/v1/${LEAGUE}/competitions$`),
    handle: ([league], query) => competitions(leagueOf(league), Number(query.get('season') ?? currentSeasonYear())),
  },
  {
    pattern: new RegExp(`^/v1/${LEAGUE}/competitions/${ID}/days/${ID}$`),
    handle: ([league, competition, dayNumber]) => day(leagueOf(league), Number(competition), Number(dayNumber)),
  },
  {
    pattern: new RegExp(`^/v1/${LEAGUE}/matches/${ID}/box-score$`),
    handle: ([league, match]) => boxScore(leagueOf(league), Number(match)),
  },
  {
    pattern: new RegExp(`^/v1/${LEAGUE}/teams/${ID}/roster$`),
    handle: ([league, team]) => roster(leagueOf(league), Number(team)),
  },
];

function leagueOf(value: string): LeagueId {
  if (!isLeagueId(value)) throw new NotFound(`Campionato sconosciuto: ${value}`);
  return value;
}

function send(req: IncomingMessage, res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  const json = JSON.stringify(body);
  const etag = `"${createHash('sha1').update(json).digest('base64url')}"`;
  if (status === 200 && req.headers['if-none-match'] === etag) {
    res.writeHead(304, { ETag: etag, ...headers }).end();
    return;
  }
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ETag: etag, ...headers }).end(json);
}

function statusOf(error: unknown): number {
  if (error instanceof NotFound) return 404;
  // Una risorsa che la sorgente non ha (404) resta un 404; ogni altro guasto è a monte di noi.
  if (error instanceof HttpError && error.status === 404) return 404;
  return 502;
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(req, res, 405, { error: 'Metodo non consentito' }, { Allow: 'GET, HEAD' });

  const url = new URL(req.url ?? '/', 'http://localhost');
  if (url.pathname === '/health') return send(req, res, 200, { status: 'ok' }, { 'Cache-Control': 'no-store' });

  for (const { pattern, handle: route } of ROUTES) {
    const match = pattern.exec(url.pathname);
    if (!match) continue;
    try {
      const payload = await route(match.slice(1), url.searchParams);
      const { maxAge, ...body } = payload;
      return send(req, res, 200, body, { 'Cache-Control': `public, max-age=${maxAge}` });
    } catch (error) {
      const status = statusOf(error);
      if (status === 502) console.error(`${req.url}: ${error instanceof Error ? (error.stack ?? error.message) : error}`);
      return send(req, res, status, { error: error instanceof Error ? error.message : 'Errore' }, { 'Cache-Control': 'no-store' });
    }
  }
  send(req, res, 404, { error: 'Percorso sconosciuto' }, { 'Cache-Control': 'no-store' });
}

if (!dir) {
  console.error('DATABASE_DIR non è impostata: aggiungila a /etc/palla-a-due/env (vedi docs/server-setup.md).');
  process.exit(2);
}
mkdirSync(dir, { recursive: true });

const server = createServer((req, res) => {
  handle(req, res).catch((error) => {
    console.error(error);
    if (!res.headersSent) res.writeHead(500).end();
  });
});
server.listen(port, host, () => console.log(`API in ascolto su http://${host}:${port}`));

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
