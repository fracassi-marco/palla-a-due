import { LeagueRanks, RankedStat, StatLine } from './entities';

const FIELDS = [
  'points',
  'minutes',
  'twoMade',
  'twoAttempted',
  'threeMade',
  'threeAttempted',
  'freeThrowsMade',
  'freeThrowsAttempted',
  'offensiveRebounds',
  'defensiveRebounds',
  'totalRebounds',
  'assists',
  'steals',
  'turnovers',
  'blocks',
  'fouls',
  'rating',
] as const satisfies readonly (keyof StatLine)[];

function reduceLines(lines: StatLine[], combine: (values: number[]) => number): StatLine | null {
  if (lines.length === 0) return null;
  const result = { matches: lines.length } as StatLine;
  for (const field of FIELDS) result[field] = combine(lines.map((l) => l[field]));
  return result;
}

const total = (values: number[]) => values.reduce((a, b) => a + b, 0);

/** Totali stagionali; `matches` è il numero di partite giocate. Null senza partite. */
export const sumLines = (lines: StatLine[]) => reduceLines(lines, total);

/** Medie a partita. Null senza partite. */
export const averageLines = (lines: StatLine[]) => reduceLines(lines, (v) => total(v) / v.length);

/** Massimi stagionali per ogni voce. Null senza partite. */
export const maxLines = (lines: StatLine[]) => reduceLines(lines, (v) => Math.max(...v));

interface RankRule {
  /** Valore da confrontare, dai totali stagionali; null se il giocatore non è classificabile. */
  value: (totals: StatLine) => number | null;
  /** Se true, vale di più un valore più basso (palle perse). */
  lowerIsBetter?: boolean;
}

const perGame = (field: keyof StatLine): RankRule => ({ value: (l) => l[field] / l.matches });

/** Le percentuali contano solo con almeno un tiro a partita, altrimenti 1/1 batterebbe tutti. */
const shooting = (made: keyof StatLine, attempted: keyof StatLine): RankRule => ({
  value: (l) => (l[attempted] >= l.matches ? l[made] / l[attempted] : null),
});

const RANK_RULES: Record<RankedStat, RankRule> = {
  points: perGame('points'),
  minutes: perGame('minutes'),
  totalRebounds: perGame('totalRebounds'),
  assists: perGame('assists'),
  rating: perGame('rating'),
  steals: perGame('steals'),
  blocks: perGame('blocks'),
  turnovers: { ...perGame('turnovers'), lowerIsBetter: true },
  twoPercent: shooting('twoMade', 'twoAttempted'),
  threePercent: shooting('threeMade', 'threeAttempted'),
  freeThrowPercent: shooting('freeThrowsMade', 'freeThrowsAttempted'),
};

export const RANKED_STATS = Object.keys(RANK_RULES) as RankedStat[];

export const isRankedStat = (value: string): value is RankedStat => value in RANK_RULES;

/** Valore della statistica per i totali stagionali di un giocatore; null se non classificabile. */
export const rankValue = (stat: RankedStat, totals: StatLine) => RANK_RULES[stat].value(totals);

/** Classifica per una statistica, dal migliore; a pari valore la posizione è condivisa. Esclude chi non è classificabile. */
export function sortByStat<T extends { totals: StatLine }>(
  stat: RankedStat,
  items: T[],
): { position: number; value: number; item: T }[] {
  const direction = RANK_RULES[stat].lowerIsBetter ? 1 : -1;
  const valued = items
    .map((item) => ({ item, value: rankValue(stat, item.totals) }))
    .filter((e): e is { item: T; value: number } => e.value !== null)
    .sort((a, b) => direction * (a.value - b.value));
  let position = 0;
  return valued.map((e, i) => {
    if (i === 0 || e.value !== valued[i - 1].value) position = i + 1;
    return { ...e, position };
  });
}

/**
 * Posizione di un giocatore tra tutti quelli della lega, dai totali stagionali di ciascuno (`league` include `own`).
 * Posizione = 1 + giocatori strettamente migliori; a pari valore la posizione è condivisa.
 */
export function rankInLeague(own: StatLine, league: StatLine[]): LeagueRanks {
  const ranks: LeagueRanks = {};
  for (const stat of Object.keys(RANK_RULES) as RankedStat[]) {
    const { value, lowerIsBetter } = RANK_RULES[stat];
    const ownValue = value(own);
    if (ownValue === null) continue;
    const values = league.map(value).filter((v): v is number => v !== null);
    const better = values.filter((v) => (lowerIsBetter ? v < ownValue : v > ownValue)).length;
    ranks[stat] = { position: better + 1, of: values.length };
  }
  return ranks;
}
