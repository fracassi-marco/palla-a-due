import { getLocales } from 'expo-localization';
import { en } from './en';
import { it, TranslationKey } from './it';

export type Locale = 'it' | 'en';

/** Italiano se la lingua preferita del dispositivo lo è, inglese per tutte le altre. Letta all'avvio: il cambio di lingua riavvia l'app. */
export const locale: Locale = getLocales()[0]?.languageCode === 'it' ? 'it' : 'en';

const dictionary: Record<TranslationKey, string> = locale === 'it' ? it : en;

type Params = Record<string, string | number>;

const fill = (template: string, params?: Params) =>
  params ? template.replace(/\{(\w+)\}/g, (match, name: string) => String(params[name] ?? match)) : template;

/** Testo nella lingua corrente; i segnaposto `{nome}` vengono sostituiti dai `params`. */
export const t = (key: TranslationKey, params?: Params): string => fill(dictionary[key], params);

/** Numero ordinale: "3°" in italiano, "3rd" in inglese. */
export function ordinal(n: number): string {
  if (locale === 'it') return `${n}°`;
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
}

/**
 * Testi che arrivano già scritti in italiano dai dati (nomi delle giornate e dei turni playoff, conference, gironi,
 * etichette del tempo di gioco) e finiscono nel database o nel backend: la lingua si applica solo al momento di mostrarli.
 */
const STORED_KEYS: TranslationKey[] = [
  ...(Object.keys(it) as TranslationKey[]).filter((k) => /^(day|playoff|group)\./.test(k)),
  'match.halftime',
  'match.endOfPeriod',
];

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const storedMatchers = STORED_KEYS.map((key) => {
  const names: string[] = [];
  const source = escapeRegExp(it[key]).replace(/\\\{(\w+)\\\}/g, (_, name: string) => {
    names.push(name);
    return '(.+?)';
  });
  return { key, names, regex: new RegExp(`^${source}$`) };
});

/** La Lega Basket scrive "7° Giornata": si riporta alla forma "Giornata 7" usata dalle altre fonti. */
const normalizeStored = (text: string) => text.replace(/^(\d+)\s*[°ºª]\s*giornata$/i, 'Giornata $1');

function translateStored(rawText: string): string | null {
  const text = normalizeStored(rawText);
  for (const { key, names, regex } of storedMatchers) {
    const found = regex.exec(text);
    if (!found) continue;
    return t(key, Object.fromEntries(names.map((name, i) => [name, found[i + 1]])));
  }
  return null;
}

export function localize(text: string): string {
  if (locale === 'it') return text;
  // "PRIMO TURNO · GARA 2": i pezzi si traducono uno per uno quando l'intera stringa non corrisponde.
  return translateStored(text) ?? text.split(' · ').map((part) => translateStored(part) ?? part).join(' · ');
}
