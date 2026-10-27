const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Ultima domenica del mese alle 01:00 UTC, quando l'Europa passa dall'ora legale a quella solare e viceversa. */
function lastSundayUtc(year: number, month: number): number {
  const lastDay = new Date(Date.UTC(year, month + 1, 0));
  return Date.UTC(year, month, lastDay.getUTCDate() - lastDay.getUTCDay(), 1);
}

function romeOffsetMs(t: number): number {
  const year = new Date(t).getUTCFullYear();
  const summer = t >= lastSundayUtc(year, 2) && t < lastSundayUtc(year, 9);
  return (summer ? 2 : 1) * HOUR_MS;
}

/** Primo mezzogiorno italiano successivo all'istante dato. */
export function nextRomeNoon(from: Date): Date {
  const t = from.getTime();
  const local = new Date(t + romeOffsetMs(t));
  let noon = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 12);
  for (let i = 0; i < 2; i++) {
    const candidate = noon - romeOffsetMs(noon);
    if (candidate > t) return new Date(candidate);
    noon += DAY_MS;
  }
  return new Date(noon);
}
