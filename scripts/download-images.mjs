#!/usr/bin/env node
// Scarica loghi delle squadre e foto dei giocatori di LBA, Serie A2, Serie B Nazionale (LNP), NBA e WNBA e genera
// il manifest `src/infrastructure/images/manifest.ts` usato dall'app.
// Uso: node scripts/download-images.mjs [anno-inizio-stagione] [--check]
// Con --check non scarica né scrive nulla: elenca le immagini che mancano e termina con codice 1 se ce ne sono.
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readdir, rename, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API = 'https://www.legabasket.it/api';
const CDN = 'https://lba-media.s3.eu-south-1.amazonaws.com';
const LNP_SITE = 'https://www.legapallacanestro.com';
// NBA: l'anagrafica sta nel CDN ufficiale, che risponde 403 ai client senza intestazioni da browser (vedi NBA_HEADERS in
// src/infrastructure/nba/NbaLeagueSource.ts, da tenere uguali); foto in grande dimensione, ridimensionate in WebP come le altre.
const NBA_PLAYER_INDEX = 'https://cdn.nba.com/static/json/staticData/playerIndex.json';
const NBA_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept: '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  Referer: 'https://www.nba.com/',
  Origin: 'https://www.nba.com',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-site',
  'sec-ch-ua': '"Chromium";v="126"',
};
// WNBA: ESPN, senza protezioni. Le chiavi hanno il suffisso `?wnba` (vedi `logoUrl` in src/infrastructure/wnba/mappers.ts) per non
// coincidere con quelle NBA (`atl.png`); nel nome del file il `?` diventa `@`.
const WNBA_API = 'https://site.api.espn.com/apis/site/v2/sports/basketball/wnba';
const NBA_HEADSHOT = 'https://cdn.nba.com/headshots/nba/latest/1040x760';
// Gli id delle squadre NBA vanno da 1610612737 a 1610612766: i giocatori svincolati hanno TEAM_ID 0.
const NBA_TEAM_ID = /^16106127[3-6]\d$/;
// Pagine con l'elenco delle squadre di Serie A2 e B Nazionale, con la cartella (campionato) in cui salvarle.
// Le immagini stanno in assets/images/<teams|players>/<campionato>/; non c'è una cartella per stagione perché le chiavi
// sono stabili (un giocatore confermato non viene scaricato di nuovo) e lo storico è già in git.
const LNP_TEAM_LISTS = [
  ['/serie/1/squadre', 'a2'],
  ['/serie/4/squadre', 'b'],
];
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const imagesDir = path.join(root, 'assets', 'images');
const manifestPath = path.join(root, 'src', 'infrastructure', 'images', 'manifest.ts');

const now = new Date();
const CHECK = process.argv.includes('--check');
const season = Number(process.argv.slice(2).find((arg) => !arg.startsWith('--'))) || (now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1);

// Gli originali sono PNG da 2-3k px (~10 MB): nell'app si include una WebP ridimensionata (con alpha).
// Richiede `cwebp` (brew install webp). Larghezze pari a ~3x la dimensione massima mostrata.
const WIDTH = { teams: 240, players: 360 };
const run = promisify(execFile);

async function toWebp(kind, source, target) {
  await run('cwebp', ['-quiet', '-q', '80', '-alpha_q', '90', '-resize', String(WIDTH[kind]), '0', source, '-o', target]);
}

async function getJson(endpoint, params) {
  const res = await fetch(`${API}${endpoint}?${new URLSearchParams(params)}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${endpoint} ${res.status}`);
  return res.json();
}

/** Nome di file di una chiave: `?` non è adatto a un percorso. */
const fileKey = (key) => key.replace('?', '@');

/** Chiave → percorso relativo a `dir` di tutti i file già presenti, anche nelle sottocartelle dei campionati. */
async function existing(dir) {
  const map = new Map();
  for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    if (entry.isDirectory()) {
      for (const f of await readdir(path.join(dir, entry.name))) map.set(path.parse(f).name, `${entry.name}/${f}`);
    } else {
      map.set(path.parse(entry.name).name, entry.name);
    }
  }
  return map;
}

/**
 * `sourcesByLeague`: campionato → (chiave → URL da cui scaricarla). La chiave è l'ultimo segmento dell'URL,
 * come in `resolveImageSource`. Se una chiave compare in più campionati vale il primo.
 * Ritorna chiave → percorso relativo a `assets/images/<kind>`.
 */
let missingCount = 0;

async function download(kind, sourcesByLeague) {
  const dir = path.join(imagesDir, kind);
  const files = await existing(dir);
  const jobs = [];
  const seen = new Map();
  for (const [league, sources] of Object.entries(sourcesByLeague)) {
    if (!CHECK) await mkdir(path.join(dir, league), { recursive: true });
    for (const [key, url] of sources) {
      if (seen.has(key)) {
        if (seen.get(key) !== url) console.warn(`  collisione sulla chiave ${kind}/${key}: ${seen.get(key)} e ${url}`);
        continue;
      }
      seen.set(key, url);
      jobs.push({ key, url, league });
    }
  }
  const result = {};
  const missing = [];
  let fetched = 0;
  let moved = 0;
  const worker = async () => {
    for (let job = jobs.pop(); job; job = jobs.pop()) {
      const { key, url, league } = job;
      const name = `${league}/${fileKey(key)}.webp`;
      const current = files.get(fileKey(key));
      if (current === name) {
        result[key] = name;
        continue;
      }
      if (current && !current.includes('/')) {
        if (CHECK) {
          result[key] = current;
          continue;
        }
        // File della vecchia struttura piatta: lo sposto nella cartella del campionato.
        await rename(path.join(dir, current), path.join(dir, name));
        moved++;
        result[key] = name;
        continue;
      }
      if (current) {
        result[key] = current;
        continue;
      }
      if (CHECK) {
        missing.push(`${league}/${key}  ${url}`);
        continue;
      }
      const res = await fetch(url);
      const buf = Buffer.from(await res.arrayBuffer());
      if (!res.ok || buf.length === 0) {
        console.warn(`  salto ${kind}/${key} (${res.status})`);
        continue;
      }
      const tmp = await mkdtemp(path.join(os.tmpdir(), 'pallaadue-'));
      try {
        await writeFile(path.join(tmp, 'original'), buf);
        await toWebp(kind, path.join(tmp, 'original'), path.join(dir, name));
      } catch (error) {
        console.warn(`  salto ${kind}/${key} (conversione fallita: ${error.message.split('\n')[0]})`);
        continue;
      } finally {
        await rm(tmp, { recursive: true, force: true });
      }
      fetched++;
      result[key] = name;
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  if (CHECK) {
    console.log(`${kind}: ${seen.size} nelle sorgenti, ${missing.length} mancanti`);
    for (const line of missing.sort()) console.log(`  + ${line}`);
    missingCount += missing.length;
    return result;
  }
  console.log(`${kind}: ${Object.keys(result).length} immagini (${fetched} nuove, ${moved} spostate)`);
  return result;
}

const { competitions } = await getJson('/championships/get-championships', { s: season });
const rs = competitions.find((c) => c.ctype_code === 'RS' && c.cserie_code === 'A1');
if (!rs) throw new Error(`Regular Season Serie A ${season} non trovata`);
const { standings } = await getJson('/championships/get-championship-ranking', { id: rs.id });

const teamSources = { lba: new Map(), a2: new Map(), b: new Map(), nba: new Map(), wnba: new Map() };
const playerSources = { lba: new Map(), a2: new Map(), b: new Map(), nba: new Map(), wnba: new Map() };
const lbaImage = (key) => [key, `${CDN}/${key}`];
for (const s of standings) {
  if (s.logo_key) teamSources.lba.set(...lbaImage(s.logo_key));
  const roster = await getJson('/teams/get-team-roster', { id: s.team_id });
  if (roster.team?.logo_key) teamSources.lba.set(...lbaImage(roster.team.logo_key));
  for (const p of roster.players ?? []) if (p.player_picture_key) playerSources.lba.set(...lbaImage(p.player_picture_key));
}

async function getHtml(url) {
  const res = await fetch(url, { headers: { Accept: 'text/html' } });
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return res.text();
}

const lastSegment = (url) => url.slice(url.lastIndexOf('/') + 1);

// LNP: gli URL devono essere gli stessi che l'app salva (logo dall'elenco squadre, foto dal roster nella scheda squadra).
for (const [list, league] of LNP_TEAM_LISTS) {
  const html = await getHtml(`${LNP_SITE}${list}`);
  const teams = [...html.matchAll(/<a href="(\/serie-[^"]+)"><img[^>]*team_logo\/(\d+)\.([a-z]+)/g)];
  for (const [, teamPath, id, ext] of teams) {
    const logo = `${LNP_SITE}/sites/default/files/styles/255_x/public/team_logo/${id}.${ext}`;
    teamSources[league].set(lastSegment(logo), logo);
    const page = await getHtml(`${LNP_SITE}${teamPath}`);
    const table = /<table[^>]*views-table[\s\S]*?<\/table>/.exec(page)?.[0] ?? '';
    for (const [, src] of table.matchAll(/<img[^>]*src="([^"]+)"/g)) {
      const photo = src.replace(/^http:/, 'https:');
      playerSources[league].set(lastSegment(photo), photo);
    }
  }
  console.log(`LNP ${list}: ${teams.length} squadre`);
}

// NBA: i logo hanno l'URL di `logoUrl` in src/infrastructure/nba/teams.ts, le foto la chiave `<personId>.png` (come in `headshotUrl`).
{
  const res = await fetch(NBA_PLAYER_INDEX, { headers: NBA_HEADERS });
  if (!res.ok) throw new Error(`NBA playerIndex ${res.status}`);
  const { headers, rowSet } = (await res.json()).resultSets[0];
  const col = (name) => headers.indexOf(name);
  const logos = new Map();
  for (const row of rowSet) {
    const teamId = String(row[col('TEAM_ID')]);
    if (!NBA_TEAM_ID.test(teamId)) continue;
    const id = row[col('PERSON_ID')];
    playerSources.nba.set(`${id}.png`, `${NBA_HEADSHOT}/${id}.png`);
    // La sigla ESPN coincide con quella NBA tranne per sei squadre.
    const code = { GSW: 'gs', NOP: 'no', NYK: 'ny', SAS: 'sa', UTA: 'utah', WAS: 'wsh' }[row[col('TEAM_ABBREVIATION')]] ?? row[col('TEAM_ABBREVIATION')].toLowerCase();
    logos.set(`${code}.png`, `https://a.espncdn.com/i/teamlogos/nba/500/${code}.png`);
  }
  for (const [key, url] of logos) teamSources.nba.set(key, url);
  console.log(`NBA: ${logos.size} squadre, ${playerSources.nba.size} giocatori`);
}

// WNBA: logo di ogni squadra e foto dei giocatori dei roster.
{
  const getEspn = async (endpoint) => {
    const res = await fetch(`${WNBA_API}${endpoint}`);
    if (!res.ok) throw new Error(`WNBA ${endpoint} ${res.status}`);
    return res.json();
  };
  const { sports } = await getEspn('/teams');
  for (const { team } of sports[0].leagues[0].teams) {
    const code = team.abbreviation.toLowerCase();
    teamSources.wnba.set(`${code}.png?wnba`, `https://a.espncdn.com/i/teamlogos/wnba/500/${code}.png`);
    for (const athlete of (await getEspn(`/teams/${team.id}/roster`)).athletes) {
      playerSources.wnba.set(`${athlete.id}.png?wnba`, `https://a.espncdn.com/i/headshots/wnba/players/full/${athlete.id}.png`);
    }
  }
  console.log(`WNBA: ${teamSources.wnba.size} squadre, ${playerSources.wnba.size} giocatori`);
}

const teams = await download('teams', teamSources);
const players = await download('players', playerSources);

if (CHECK) {
  console.log(missingCount === 0 ? 'Nessuna immagine nuova.' : `${missingCount} immagini nuove: lancia lo script senza --check per scaricarle.`);
  process.exit(missingCount === 0 ? 0 : 1);
}

const entries = (kind, map) =>
  Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, file]) => `    '${key}': require('../../../assets/images/${kind}/${file}'),`)
    .join('\n');

await mkdir(path.dirname(manifestPath), { recursive: true });
await writeFile(
  manifestPath,
  `// File generato da scripts/download-images.mjs: non modificare a mano.
import { ImageSource } from 'expo-image';

export const bundledImages: Record<string, ImageSource> = {
${entries('teams', teams)}
${entries('players', players)}
};
`,
);
console.log(`Manifest scritto: ${path.relative(root, manifestPath)}`);
