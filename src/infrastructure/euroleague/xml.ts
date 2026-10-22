/**
 * L'API v1 di Euroleague risponde in XML. Gli elementi che servono sono piatti (figli di solo testo oppure attributi),
 * quindi bastano due letture a espressione regolare invece di un parser (React Native non ha DOMParser).
 */
const ENTITIES: Record<string, string> = { lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' };

const decode = (text: string) =>
  text.replace(/&(#\d+|lt|gt|quot|apos|amp);/g, (_, e: string) =>
    e.startsWith('#') ? String.fromCodePoint(Number(e.slice(1))) : ENTITIES[e],
  );

/** `<tag><a>1</a><b>x</b></tag>` → `{ a: '1', b: 'x' }`, uno per ogni `<tag>`; i figli non piatti sono ignorati. */
export function textRecords(xml: string, tag: string): Record<string, string>[] {
  return [...xml.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g'))].map(([, body]) =>
    Object.fromEntries([...body.matchAll(/<(\w+)>([^<]*)<\/\1>/g)].map(([, name, value]) => [name, decode(value)])),
  );
}

/** Attributi di una stringa come `code="BAR" tvcode="BAR"`. */
export function attributes(source: string): Record<string, string> {
  return Object.fromEntries([...source.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, name, value]) => [name, decode(value)]));
}

/** Attributi di ogni elemento `<tag a="1" b="2">` o `<tag a="1" />` (il nome deve essere seguito da uno spazio). */
export function attributeRecords(xml: string, tag: string): Record<string, string>[] {
  return [...xml.matchAll(new RegExp(`<${tag}\\s([^>]*?)/?>`, 'g'))].map(([, source]) => attributes(source));
}

/** Contenuto del primo `<tag …>…</tag>`, stringa vuota se manca. */
export function section(xml: string, tag: string): string {
  return new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`).exec(xml)?.[1] ?? '';
}
