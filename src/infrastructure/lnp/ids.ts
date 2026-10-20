import { LnpGroup, LnpSeries } from './series';

/**
 * LNP usa id testuali ("ita2_403", "A59109") e li ripete ogni stagione; il database dell'app vuole interi unici.
 * Competizione = (anno a 2 cifre, girone); partita = competizione e numero di gara. Entrambi si decodificano,
 * perché per scaricare un box score servono girone e stagione.
 */
const MATCH_SPACE = 100_000;
const PLAYER_HASH_OFFSET = 10_000_000_000;

export const competitionId = (seasonYear: number, group: LnpGroup) => (seasonYear % 100) * 10 + group.code;

export const matchId = (competition: number, gameNumber: number) => competition * MATCH_SPACE + gameNumber;

export interface MatchRef {
  group: LnpGroup;
  seasonYear: number;
  gameNumber: number;
}

export function decodeCompetitionId(series: LnpSeries, competition: number): { group: LnpGroup; seasonYear: number } {
  const group = series.groups.find((g) => g.code === competition % 10);
  if (!group) throw new Error(`Competizione ${competition} sconosciuta`);
  return { group, seasonYear: 2000 + Math.floor(competition / 10) };
}

export function decodeMatchId(series: LnpSeries, id: number): MatchRef {
  const { group, seasonYear } = decodeCompetitionId(series, Math.floor(id / MATCH_SPACE));
  return { group, seasonYear, gameNumber: id % MATCH_SPACE };
}

/** "ita3_a_403" → 403. */
export const gameNumber = (gameId: string) => Number(gameId.slice(gameId.lastIndexOf('_') + 1));

/** Stagione nel formato delle pagine LNP: 2026 → "x2627". */
export const seasonKey = (seasonYear: number) => {
  const two = (n: number) => String(n % 100).padStart(2, '0');
  return `x${two(seasonYear)}${two(seasonYear + 1)}`;
};

/** Gli id giocatore "A59109" diventano 59109; quelli alfanumerici ("Q5fUgPgJ") un hash stabile. */
export function playerId(rawId: string): number {
  const numeric = /^A(\d+)$/.exec(rawId);
  if (numeric) return Number(numeric[1]);
  let hash = 0x811c9dc5;
  for (let i = 0; i < rawId.length; i++) hash = Math.imul(hash ^ rawId.charCodeAt(i), 0x01000193);
  return PLAYER_HASH_OFFSET + (hash >>> 0);
}
