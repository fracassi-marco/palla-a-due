#!/usr/bin/env node
// Scarica loghi delle squadre e foto dei giocatori di LBA, Serie A2 e Serie B Nazionale (LNP) e genera
// il manifest `src/infrastructure/images/manifest.ts` usato dall'app.
// Uso: node scripts/download-images.mjs [anno-inizio-stagione]
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readdir, rename, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API = 'https://www.legabasket.it/api';
const CDN = 'https://lba-media.s3.eu-south-1.amazonaws.com';
const LNP_SITE = 'https://www.legapallacanestro.com';
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
const season = Number(process.argv[2]) || (now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1);

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
async function download(kind, sourcesByLeague) {
  const dir = path.join(imagesDir, kind);
  const files = await existing(dir);
  const jobs = [];
  const seen = new Set();
  for (const [league, sources] of Object.entries(sourcesByLeague)) {
    await mkdir(path.join(dir, league), { recursive: true });
    for (const [key, url] of sources) {
      if (seen.has(key)) continue;
      seen.add(key);
      jobs.push({ key, url, league });
    }
  }
  const result = {};
  let fetched = 0;
  let moved = 0;
  const worker = async () => {
    for (let job = jobs.pop(); job; job = jobs.pop()) {
      const { key, url, league } = job;
      const name = `${league}/${key}.webp`;
      const current = files.get(key);
      if (current === name) {
        result[key] = name;
        continue;
      }
      if (current && !current.includes('/')) {
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
      const res = await fetch(url);
      const buf = Buffer.from(await res.arrayBuffer());
      if (!res.ok || buf.length === 0) {
        console.warn(`  salto ${kind}/${key} (${res.status})`);
        continue;
      }
      const tmp = await mkdtemp(path.join(os.tmpdir(), 'tuttobasket-'));
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
  console.log(`${kind}: ${Object.keys(result).length} immagini (${fetched} nuove, ${moved} spostate)`);
  return result;
}

const { competitions } = await getJson('/championships/get-championships', { s: season });
const rs = competitions.find((c) => c.ctype_code === 'RS' && c.cserie_code === 'A1');
if (!rs) throw new Error(`Regular Season Serie A ${season} non trovata`);
const { standings } = await getJson('/championships/get-championship-ranking', { id: rs.id });

const teamSources = { lba: new Map(), a2: new Map(), b: new Map() };
const playerSources = { lba: new Map(), a2: new Map(), b: new Map() };
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

const teams = await download('teams', teamSources);
const players = await download('players', playerSources);

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
