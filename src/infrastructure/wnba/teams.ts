/**
 * Le 15 squadre WNBA della stagione 2026. L'id è quello ufficiale (`teamId` dell'API NBA); `espn` è la sigla usata da ESPN
 * quando differisce dalla ufficiale (e dà il nome del logo incluso nell'app).
 * L'ordine fissa l'indice (1-15) con cui le squadre entrano nell'id numerico di una partita (vedi `ids.ts`):
 * non va cambiato, né va inserita una squadra nel mezzo: le nuove si aggiungono in fondo.
 */
export interface WnbaTeam {
  id: number;
  code: string;
  name: string;
  espn?: string;
}

export const WNBA_TEAMS: readonly WnbaTeam[] = [
  { id: 1611661330, code: 'ATL', name: 'Atlanta Dream' },
  { id: 1611661329, code: 'CHI', name: 'Chicago Sky' },
  { id: 1611661323, code: 'CON', name: 'Connecticut Sun' },
  { id: 1611661321, code: 'DAL', name: 'Dallas Wings' },
  { id: 1611661331, code: 'GSV', name: 'Golden State Valkyries', espn: 'GS' },
  { id: 1611661325, code: 'IND', name: 'Indiana Fever' },
  { id: 1611661320, code: 'LAS', name: 'Los Angeles Sparks', espn: 'LA' },
  { id: 1611661319, code: 'LVA', name: 'Las Vegas Aces', espn: 'LV' },
  { id: 1611661324, code: 'MIN', name: 'Minnesota Lynx' },
  { id: 1611661313, code: 'NYL', name: 'New York Liberty', espn: 'NY' },
  { id: 1611661317, code: 'PHX', name: 'Phoenix Mercury' },
  { id: 1611661327, code: 'PDX', name: 'Portland Fire', espn: 'POR' },
  { id: 1611661328, code: 'SEA', name: 'Seattle Storm' },
  { id: 1611661332, code: 'TOR', name: 'Toronto Tempo' },
  { id: 1611661322, code: 'WAS', name: 'Washington Mystics', espn: 'WSH' },
];

const byId = new Map(WNBA_TEAMS.map((t) => [t.id, t]));
const byCode = new Map(WNBA_TEAMS.map((t) => [t.code, t]));
const byEspnCode = new Map(WNBA_TEAMS.map((t) => [t.espn ?? t.code, t]));

export const wnbaTeamById = (id: number) => byId.get(id);
export const wnbaTeamByCode = (code: string) => byCode.get(code);
export const wnbaTeamByEspnCode = (code: string) => byEspnCode.get(code);

/** Indice 1-15 della squadra. */
export const teamIndex = (team: WnbaTeam) => WNBA_TEAMS.indexOf(team) + 1;
export const teamAtIndex = (index: number) => WNBA_TEAMS[index - 1];

/**
 * Logo PNG di ESPN (`gs.png`, `la.png`…), quello incluso nell'app. Quello ufficiale è solo SVG con lo stesso nome per ogni squadra,
 * quindi non va bene come chiave del manifest immagini (ultimo segmento dell'URL). Il suffisso `?wnba` evita che la chiave coincida
 * con un logo NBA (`atl.png` è anche l'Atlanta Hawks). Va tenuto uguale a `scripts/download-images.mjs`.
 */
export const logoUrl = (team: WnbaTeam) => `https://a.espncdn.com/i/teamlogos/wnba/500/${(team.espn ?? team.code).toLowerCase()}.png?wnba`;
