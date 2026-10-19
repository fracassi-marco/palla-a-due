#!/usr/bin/env node
// Scarica loghi delle squadre e foto dei giocatori della Serie A LBA e genera
// il manifest `src/infrastructure/images/manifest.ts` usato dall'app.
// Uso: node scripts/download-images.mjs [anno-inizio-stagione]
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API = 'https://www.legabasket.it/api';
const CDN = 'https://lba-media.s3.eu-south-1.amazonaws.com';
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

async function existing(dir) {
  const map = new Map();
  for (const f of await readdir(dir).catch(() => [])) map.set(path.parse(f).name, f);
  return map;
}

async function download(kind, keys) {
  const dir = path.join(imagesDir, kind);
  await mkdir(dir, { recursive: true });
  const files = await existing(dir);
  const result = {};
  let fetched = 0;
  const queue = [...keys];
  const worker = async () => {
    for (let key = queue.pop(); key; key = queue.pop()) {
      if (!files.has(key)) {
        const res = await fetch(`${CDN}/${key}`);
        const buf = Buffer.from(await res.arrayBuffer());
        if (!res.ok || buf.length === 0) {
          console.warn(`  salto ${kind}/${key} (${res.status})`);
          continue;
        }
        const tmp = await mkdtemp(path.join(os.tmpdir(), 'tuttobasket-'));
        try {
          await writeFile(path.join(tmp, 'original'), buf);
          await toWebp(kind, path.join(tmp, 'original'), path.join(dir, `${key}.webp`));
        } catch (error) {
          console.warn(`  salto ${kind}/${key} (conversione fallita: ${error.message.split('\n')[0]})`);
          continue;
        } finally {
          await rm(tmp, { recursive: true, force: true });
        }
        const name = `${key}.webp`;
        files.set(key, name);
        fetched++;
      }
      result[key] = files.get(key);
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  console.log(`${kind}: ${Object.keys(result).length} immagini (${fetched} nuove)`);
  return result;
}

const { competitions } = await getJson('/championships/get-championships', { s: season });
const rs = competitions.find((c) => c.ctype_code === 'RS' && c.cserie_code === 'A1');
if (!rs) throw new Error(`Regular Season Serie A ${season} non trovata`);
const { standings } = await getJson('/championships/get-championship-ranking', { id: rs.id });

const teamKeys = new Set();
const playerKeys = new Set();
for (const s of standings) {
  if (s.logo_key) teamKeys.add(s.logo_key);
  const roster = await getJson('/teams/get-team-roster', { id: s.team_id });
  if (roster.team?.logo_key) teamKeys.add(roster.team.logo_key);
  for (const p of roster.players ?? []) if (p.player_picture_key) playerKeys.add(p.player_picture_key);
}

const teams = await download('teams', teamKeys);
const players = await download('players', playerKeys);

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
