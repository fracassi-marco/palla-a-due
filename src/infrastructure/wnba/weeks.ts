/**
 * Le "giornate" della WNBA sono le settimane (lunedì-domenica) a partire da quella della prima partita di Regular Season,
 * come per la NBA (`nba/weeks.ts`). ESPN non le numera: si calcolano dalle date (AAAAMMGG, ora della costa Est, come le raggruppa ESPN).
 */
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
/** La Regular Season va da maggio a settembre: la costa Est è sempre in ora legale (UTC-4). */
const EASTERN_OFFSET_MS = 4 * 60 * 60 * 1000;

const parseDate = (date: string) => Date.UTC(Number(date.slice(0, 4)), Number(date.slice(4, 6)) - 1, Number(date.slice(6, 8)));

/** Data AAAAMMGG (costa Est) di un istante ISO. */
export const easternDate = (iso: string) =>
  new Date(Date.parse(iso) - EASTERN_OFFSET_MS).toISOString().slice(0, 10).replaceAll('-', '');

/** Lunedì (mezzanotte UTC) della settimana di una data AAAAMMGG. */
export function mondayOf(date: string): number {
  const day = parseDate(date);
  return day - ((new Date(day).getUTCDay() + 6) % 7) * DAY_MS;
}

/** Settimana (1…) di una data, contando dal lunedì `firstMonday`. */
export const weekOf = (firstMonday: number, date: string) => Math.floor((parseDate(date) - firstMonday) / WEEK_MS) + 1;

/** Le sette date AAAAMMGG della settimana. */
export function datesOfWeek(firstMonday: number, week: number): string[] {
  const start = firstMonday + (week - 1) * WEEK_MS;
  return Array.from({ length: 7 }, (_, i) => new Date(start + i * DAY_MS).toISOString().slice(0, 10).replaceAll('-', ''));
}
