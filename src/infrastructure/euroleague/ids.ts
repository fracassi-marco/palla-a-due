/**
 * Euroleague usa codici testuali (club "BAR", persone "006590" o "BEY") e l'app vuole interi unici.
 * Competizione = (anno a 2 cifre, ordine del girone); partita = competizione e numero di gara della stagione.
 * Come per LNP entrambi si decodificano: per scaricare un box score servono stagione e numero di gara.
 */
const MATCH_SPACE = 100_000;
const HASH_OFFSET = 10_000_000_000;

export const competitionId = (seasonYear: number, groupOrder: number) => (seasonYear % 100) * 10 + groupOrder;

export const matchId = (competition: number, gameCode: number) => competition * MATCH_SPACE + gameCode;

export const decodeCompetitionId = (competition: number) => ({
  seasonYear: 2000 + Math.floor(competition / 10),
  groupOrder: competition % 10,
});

export function decodeMatchId(id: number) {
  return {
    ...decodeCompetitionId(Math.floor(id / MATCH_SPACE)),
    gameCode: id % MATCH_SPACE,
  };
}

/** Codice stagione dell'API: coppa "E" e anno 2026 → "E2026". */
export const seasonCode = (code: string, seasonYear: number) => `${code}${seasonYear}`;

function hash(raw: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) h = Math.imul(h ^ raw.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/** Il codice del club è alfabetico: un hash stabile ne fa l'id numerico. */
export const clubId = (code: string) => hash(code);

/** I codici persona numerici ("006590") diventano 6590; gli altri ("BEY") un hash stabile, fuori da quell'intervallo. */
export const personId = (code: string) => (/^\d+$/.test(code) ? Number(code) : HASH_OFFSET + hash(code));
