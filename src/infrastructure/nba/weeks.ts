/**
 * Le "giornate" della NBA sono le settimane (lunedì-domenica) a partire da quella dell'esordio: la NBA le numera
 * così (`weekNumber`) e ESPN non le numera affatto. Una funzione sola per entrambe le fonti, così una partita cade
 * sempre nella stessa giornata. Verificato sul calendario 2026/27: 1.200 partite su 1.200 coincidono con `weekNumber`.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

/** Regular Season: 25 settimane (la stagione 2026/27 va dal 20/10/2026 al 12/04/2027). */
export const REGULAR_SEASON_WEEKS = 25;

/** Lunedì della settimana d'esordio, a mezzanotte UTC: l'esordio è il primo martedì dal 19 ottobre (21/10/2025, 20/10/2026). */
export function firstMonday(seasonYear: number): number {
  const opener = new Date(Date.UTC(seasonYear, 9, 19));
  while (opener.getUTCDay() !== 2) opener.setUTCDate(opener.getUTCDate() + 1);
  return opener.getTime() - DAY_MS;
}

const parseDate = (date: string) => Date.UTC(Number(date.slice(0, 4)), Number(date.slice(4, 6)) - 1, Number(date.slice(6, 8)));

/** Settimana (1-25) di una data AAAAMMGG. */
export const weekOf = (seasonYear: number, date: string) => Math.floor((parseDate(date) - firstMonday(seasonYear)) / (7 * DAY_MS)) + 1;

/** Le sette date AAAAMMGG della settimana. */
export function datesOfWeek(seasonYear: number, week: number): string[] {
  const start = firstMonday(seasonYear) + (week - 1) * 7 * DAY_MS;
  return Array.from({ length: 7 }, (_, i) => new Date(start + i * DAY_MS).toISOString().slice(0, 10).replaceAll('-', ''));
}
