const DAYS = ['DOM', 'LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB'];
const MONTHS = ['GEN', 'FEB', 'MAR', 'APR', 'MAG', 'GIU', 'LUG', 'AGO', 'SET', 'OTT', 'NOV', 'DIC'];

const two = (v: number) => String(v).padStart(2, '0');

export const formatTime = (d: Date) => `${two(d.getHours())}:${two(d.getMinutes())}`;
export const formatDayMonth = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
export const formatWeekday = (d: Date) => DAYS[d.getDay()];

export function ageFrom(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--;
  return age;
}

export const one = (v: number) => (Math.round(v * 10) / 10).toFixed(1);

export function percent(made: number, attempted: number): string {
  if (!attempted) return '–';
  return `${Math.round((made / attempted) * 100)}%`;
}
