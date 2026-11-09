import { locale } from '../../i18n';

const DAYS = {
  it: ['DOM', 'LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB'],
  en: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
}[locale];
const MONTHS = {
  it: ['GEN', 'FEB', 'MAR', 'APR', 'MAG', 'GIU', 'LUG', 'AGO', 'SET', 'OTT', 'NOV', 'DIC'],
  en: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'],
}[locale];

const two = (v: number) => String(v).padStart(2, '0');

export const formatTime = (d: Date) => {
  if (locale === 'it') return `${two(d.getHours())}:${two(d.getMinutes())}`;
  return `${d.getHours() % 12 || 12}:${two(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
};
export const formatDayMonth = (d: Date) => (locale === 'it' ? `${d.getDate()} ${MONTHS[d.getMonth()]}` : `${MONTHS[d.getMonth()]} ${d.getDate()}`);
export const formatDayMonthYear = (d: Date) => {
  const year = String(d.getFullYear()).slice(2);
  return locale === 'it' ? `${formatDayMonth(d)} ${year}` : `${formatDayMonth(d)} '${year}`;
};
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
