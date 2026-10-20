import { BoxScorePlayer, BoxScoreSide, Coach, GameStats, MatchBoxScore, Player } from '../../domain/entities';
import { playerId } from './ids';

const ENTITIES: Record<string, string> = { amp: '&', nbsp: ' ', quot: '"', apos: "'", lt: '<', gt: '>' };

const decode = (html: string) =>
  html.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    return ENTITIES[entity.toLowerCase()] ?? match;
  });

/** Testo visibile di un frammento HTML. */
export const textOf = (html: string) => decode(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

/** Celle (HTML) di ogni riga del `tbody` della prima tabella del frammento. */
function bodyRows(tableHtml: string): string[][] {
  const body = tableHtml.slice(Math.max(tableHtml.indexOf('<tbody'), 0));
  return [...body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((row) =>
    [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((cell) => cell[1]),
  );
}

const toInt = (value: string | undefined) => {
  const n = parseFloat((value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n) : 0;
};

/** "19" oppure "19:20" → minuti interi. */
const toMinutes = (value: string | undefined) => toInt((value ?? '').split(':')[0]);

/** I box score LNP scrivono "Nome Cognome": il nome è la prima parola, il resto il cognome. */
export function splitBoxScoreName(full: string): { firstName: string; lastName: string } {
  const [first, ...rest] = full.split(' ');
  return rest.length === 0 ? { firstName: '', lastName: first } : { firstName: first, lastName: rest.join(' ') };
}

/** Colonne della tabella delle statistiche, nell'ordine in cui compaiono. */
function toGameStats(cells: string[]): GameStats {
  const n = (i: number) => toInt(cells[i]);
  return {
    points: n(0),
    minutes: toMinutes(cells[1]),
    fouls: n(2),
    foulsDrawn: n(3),
    twoMade: n(4),
    twoAttempted: n(5),
    threeMade: n(7),
    threeAttempted: n(8),
    freeThrowsMade: n(10),
    freeThrowsAttempted: n(11),
    offensiveRebounds: n(13),
    defensiveRebounds: n(14),
    totalRebounds: n(15),
    blocks: n(16),
    blocksAgainst: n(17),
    turnovers: n(18),
    steals: n(19),
    assists: n(20),
    rating: n(21),
  };
}

const sumStats = (players: BoxScorePlayer[]): GameStats => {
  const total = toGameStats([]);
  for (const { stats } of players) {
    for (const key of Object.keys(total) as (keyof GameStats)[]) total[key] += stats[key];
  }
  return total;
};

const playerPhoto = (season: string, rawId: string) => `https://lnp.webpont.com/team/images/player/${season}/${rawId}.jpg`;

function parseSide(block: string, season: string): BoxScoreSide {
  const leftEnd = block.indexOf('</table>');
  const rightStart = block.indexOf('class="table-right"', leftEnd);
  if (leftEnd < 0 || rightStart < 0) return { players: [], totals: toGameStats([]) };

  const left = bodyRows(block.slice(0, leftEnd));
  const right = bodyRows(block.slice(rightStart, block.indexOf('</table>', rightStart)));

  const players: BoxScorePlayer[] = [];
  let totals: GameStats | null = null;
  left.forEach(([jersey, starter, name], i) => {
    const stats = right[i];
    if (!stats || name === undefined) return;
    const link = /\/giocatore\/wp\/([^"/]+)"/.exec(name);
    if (link) {
      players.push({
        id: playerId(link[1]),
        ...splitBoxScoreName(textOf(name)),
        number: textOf(jersey ?? '') || '-',
        photoUrl: playerPhoto(season, link[1]),
        starter: textOf(starter ?? '') === '*',
        plusMinus: 0,
        stats: toGameStats(stats.map(textOf)),
      });
    } else if (textOf(name) === 'Totali') {
      totals = toGameStats(stats.map(textOf));
    }
  });
  return { players, totals: totals ?? sumStats(players) };
}

/** Box score dalla pagina HTML della partita: un blocco `table-left`/`table-right` per squadra, prima la squadra di casa. */
export function parseBoxScore(html: string, season: string): MatchBoxScore {
  const [home, away] = html
    .split('class="table-left"')
    .slice(1)
    .map((block) => parseSide(block, season));
  const empty = { players: [], totals: toGameStats([]) };
  return { home: home ?? empty, away: away ?? empty };
}

export interface TeamListing {
  /** Percorso della scheda della squadra. */
  path: string;
  /** Estensione del file del logo, che cambia da squadra a squadra. */
  logoExtension: string;
}

/** Squadre della pagina elenco, per id (che è il nome del file del logo). */
export function parseTeamListing(html: string): Map<number, TeamListing> {
  const teams = new Map<number, TeamListing>();
  for (const m of html.matchAll(/<a href="(\/serie-[^"]+)"><img[^>]*team_logo\/(\d+)\.([a-z]+)/g)) {
    teams.set(Number(m[2]), { path: m[1], logoExtension: m[3] });
  }
  return teams;
}

/** "14/2/1994" → "1994-02-14". */
function toIsoDate(value: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
}

export interface TeamPage {
  name: string;
  coach: string | null;
  players: Omit<Player, 'teamId' | 'teamName'>[];
}

const words = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/** Chiave che non dipende dall'ordine delle parole: il roster scrive "Cognome Nome", le statistiche "Nome Cognome". */
const nameKey = (name: string) => words(name).sort().join(' ');

/**
 * Nome e cognome da "Cognome Nome" (roster) e "Nome Cognome" (statistiche): le due stringhe sono la stessa
 * sequenza di parole ruotata, e il punto di rotazione è il confine. Senza corrispondenza, nome = ultima parola.
 */
function splitName(rosterName: string, statsName: string | null): { firstName: string; lastName: string } {
  const parts = rosterName.split(' ');
  const target = statsName ? words(statsName).join(' ') : null;
  for (let cut = 1; cut < parts.length; cut++) {
    const rotated = [...parts.slice(cut), ...parts.slice(0, cut)];
    if (target === words(rotated.join(' ')).join(' ')) {
      return { firstName: parts.slice(cut).join(' '), lastName: parts.slice(0, cut).join(' ') };
    }
  }
  const first = parts.pop() ?? '';
  return parts.length === 0 ? { firstName: '', lastName: first } : { firstName: first, lastName: parts.join(' ') };
}

const https = (url: string) => url.replace(/^http:/, 'https:');

/**
 * Scheda squadra: nome, allenatore e tabella del roster. Gli id usati dalle statistiche si leggono dai link
 * `/giocatore/wp/<id>` delle altre tabelle della pagina (la foto del roster ha un id diverso), incrociando i nomi.
 */
export function parseTeamPage(html: string): TeamPage {
  const name = /squadra-spec--nome">([^<]*)</.exec(html)?.[1] ?? '';
  const coach = /squadra-spec--allenatore[\s\S]*?spec-value">([^<]*)</.exec(html)?.[1] ?? null;

  const statsPlayers = new Map<string, { rawId: string; name: string }>();
  for (const m of html.matchAll(/<a href="\/giocatore\/wp\/([^"/]+)"[^>]*>([^<]*)<\/a>/g)) {
    const fullName = textOf(m[2]);
    statsPlayers.set(nameKey(fullName), { rawId: m[1], name: fullName });
  }

  const players: TeamPage['players'] = [];
  const table = /<table[^>]*views-table[\s\S]*?<\/table>/.exec(html)?.[0] ?? '';
  for (const [number, athlete, role, birth, height, weight, country] of bodyRows(table)) {
    const rosterName = textOf(athlete ?? '');
    const photo = /<img[^>]*src="([^"]+)"/.exec(athlete ?? '')?.[1] ?? null;
    const known = statsPlayers.get(nameKey(rosterName));
    // Chi non ha statistiche non compare nei link: l'id della foto basta a distinguerlo.
    const rawId = known?.rawId ?? /\/([^/]+)\.[a-z]+$/i.exec(photo ?? '')?.[1];
    if (!rawId) continue;
    players.push({
      id: playerId(rawId),
      ...splitName(rosterName, known?.name ?? null),
      number: textOf(number ?? '') || '-',
      role: textOf(role ?? ''),
      country: textOf(country ?? ''),
      birthDate: toIsoDate(textOf(birth ?? '')),
      birthPlace: null,
      heightCm: toInt(height) || null,
      weightKg: toInt(weight) || null,
      photoUrl: photo ? https(photo) : null,
    });
  }
  return { name: decode(name).trim(), coach: coach ? decode(coach).trim() : null, players };
}

export function toCoach(teamId: number, fullName: string): Coach {
  return { id: teamId, ...splitBoxScoreName(fullName), photoUrl: null };
}
