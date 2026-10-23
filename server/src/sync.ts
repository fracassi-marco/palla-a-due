/**
 * Sincronizzazione giornaliera di un campionato: `node sync.js --league <codice>`.
 * Usa lo stesso `SyncLeague` della app (calendario, box score, roster) e scrive in `<DATABASE_DIR>/<campionato>.db`.
 * Esce con codice 1 se qualche richiesta non è riuscita, così systemd segna l'unità come fallita.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { SyncLeague, SyncState } from '../../src/application/SyncLeague';
import { createSource } from '../../src/di/createSource';
import { LeagueId } from '../../src/domain/League';
import { SqliteLeagueStore } from '../../src/infrastructure/db/SqliteLeagueStore';
import { SqliteMatchRepository } from '../../src/infrastructure/db/SqliteMatchRepository';
import { BetterSqliteDatabase } from './BetterSqliteDatabase';

/** Codice del timer systemd → campionati sincronizzati (EuroLeague ed EuroCup condividono la sorgente e il timer). */
const GROUPS: Record<string, LeagueId[]> = {
  'lnp-a2': ['a2'],
  'lnp-b': ['b'],
  lba: ['lba'],
  euroleague: ['euroleague', 'eurocup'],
  nba: ['nba'],
};

/** Il server è un unico client: richieste in parallelo contenute per non far scattare i limiti (429) delle API. */
const SYNC_CONCURRENCY = 2;
const PING_TIMEOUT_MS = 10_000;
/** EuroLeague ed EuroCup interrogano lo stesso host: senza pausa il secondo campionato prende 429. */
const PAUSE_BETWEEN_LEAGUES_MS = 90_000;

const log = (message: string) => console.log(message);

function parseGroup(argv: string[]): string {
  const index = argv.indexOf('--league');
  const code = index >= 0 ? argv[index + 1] : undefined;
  if (!code || !(code in GROUPS)) {
    console.error(`Uso: node sync.js --league <${Object.keys(GROUPS).join('|')}>`);
    process.exit(2);
  }
  return code;
}

/** Segnala l'esito a healthchecks.io (o simili); un ping che non arriva non deve far fallire la sincronizzazione. */
async function ping(code: string, ok: boolean): Promise<void> {
  const base = process.env[`HEALTHCHECK_URL_${code.toUpperCase().replace(/-/g, '_')}`];
  if (!base) return;
  try {
    await fetch(ok ? base : `${base.replace(/\/$/, '')}/fail`, { signal: AbortSignal.timeout(PING_TIMEOUT_MS) });
  } catch (error) {
    console.warn(`[${code}] ping non riuscito: ${error instanceof Error ? error.message : error}`);
  }
}

async function syncLeague(league: LeagueId, dir: string): Promise<SyncState> {
  const database = new BetterSqliteDatabase(join(dir, `${league}.db`));
  try {
    const sync = new SyncLeague(createSource(league, new SqliteMatchRepository(database)), new SqliteLeagueStore(database), SYNC_CONCURRENCY);
    let phase = '';
    sync.subscribe(() => {
      const { status, phase: current, total } = sync.getState();
      if (status === 'running' && current && current !== phase) {
        phase = current;
        log(`[${league}] ${current}: ${total} da scaricare`);
      }
    });
    await sync.start();
    return sync.getState();
  } finally {
    await database.close();
  }
}

async function main() {
  const code = parseGroup(process.argv.slice(2));
  const dir = process.env.DATABASE_DIR ?? (process.env.NODE_ENV === 'production' ? '' : './data');
  if (!dir) {
    console.error('DATABASE_DIR non è impostata: aggiungila a /etc/palla-a-due/env (vedi docs/server-setup.md).');
    process.exit(2);
  }
  mkdirSync(dir, { recursive: true });

  let failed = false;
  for (const [index, league] of GROUPS[code].entries()) {
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, PAUSE_BETWEEN_LEAGUES_MS));
    const startedAt = Date.now();
    try {
      const state = await syncLeague(league, dir);
      const seconds = Math.round((Date.now() - startedAt) / 1000);
      if (state.status === 'error') {
        failed = true;
        console.error(`[${league}] ERRORE dopo ${seconds}s: ${state.error}`);
      } else {
        log(`[${league}] ok in ${seconds}s`);
      }
    } catch (error) {
      failed = true;
      console.error(`[${league}] ERRORE: ${error instanceof Error ? (error.stack ?? error.message) : error}`);
    }
  }

  await ping(code, !failed);
  process.exitCode = failed ? 1 : 0;
}

void main();
