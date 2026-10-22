/** Parole che non identificano la squadra: nomi della società e sponsor generici. */
const GENERIC = new Set(['basket', 'basketball', 'pallacanestro', 'club', 'team', 'societa', 'sportiva', 'asd', 'spa', 'srl']);
/** Due parole con questo prefisso in comune sono la stessa ("Trento" e "Trentino"). */
const PREFIX = 5;

function words(name: string): string[] {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !GENERIC.has(w));
}

const sameWord = (a: string, b: string) => a === b || (a.length >= PREFIX && b.length >= PREFIX && a.slice(0, PREFIX) === b.slice(0, PREFIX));

/** Parole in comune tra due nomi di squadra scritti in modo diverso da due fonti ("Dolomiti Energia Trentino" e "Trento"). */
export function nameOverlap(a: string, b: string): number {
  const other = words(b);
  return words(a).filter((w) => other.some((o) => sameWord(w, o))).length;
}
