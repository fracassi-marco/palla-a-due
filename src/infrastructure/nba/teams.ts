/**
 * Le 30 squadre NBA. L'id è quello ufficiale (`teamId` dell'API NBA); `espn` è la sigla usata da ESPN quando differisce.
 * L'ordine fissa l'indice (1-30) con cui le squadre entrano nell'id numerico di una partita (vedi `ids.ts`):
 * non va cambiato, né va inserita una squadra nel mezzo.
 */
export interface NbaTeam {
  id: number;
  code: string;
  name: string;
  espn?: string;
}

export const NBA_TEAMS: readonly NbaTeam[] = [
  { id: 1610612737, code: 'ATL', name: 'Atlanta Hawks' },
  { id: 1610612738, code: 'BOS', name: 'Boston Celtics' },
  { id: 1610612751, code: 'BKN', name: 'Brooklyn Nets' },
  { id: 1610612766, code: 'CHA', name: 'Charlotte Hornets' },
  { id: 1610612741, code: 'CHI', name: 'Chicago Bulls' },
  { id: 1610612739, code: 'CLE', name: 'Cleveland Cavaliers' },
  { id: 1610612742, code: 'DAL', name: 'Dallas Mavericks' },
  { id: 1610612743, code: 'DEN', name: 'Denver Nuggets' },
  { id: 1610612765, code: 'DET', name: 'Detroit Pistons' },
  { id: 1610612744, code: 'GSW', name: 'Golden State Warriors', espn: 'GS' },
  { id: 1610612745, code: 'HOU', name: 'Houston Rockets' },
  { id: 1610612754, code: 'IND', name: 'Indiana Pacers' },
  { id: 1610612746, code: 'LAC', name: 'LA Clippers' },
  { id: 1610612747, code: 'LAL', name: 'Los Angeles Lakers' },
  { id: 1610612763, code: 'MEM', name: 'Memphis Grizzlies' },
  { id: 1610612748, code: 'MIA', name: 'Miami Heat' },
  { id: 1610612749, code: 'MIL', name: 'Milwaukee Bucks' },
  { id: 1610612750, code: 'MIN', name: 'Minnesota Timberwolves' },
  { id: 1610612740, code: 'NOP', name: 'New Orleans Pelicans', espn: 'NO' },
  { id: 1610612752, code: 'NYK', name: 'New York Knicks', espn: 'NY' },
  { id: 1610612760, code: 'OKC', name: 'Oklahoma City Thunder' },
  { id: 1610612753, code: 'ORL', name: 'Orlando Magic' },
  { id: 1610612755, code: 'PHI', name: 'Philadelphia 76ers' },
  { id: 1610612756, code: 'PHX', name: 'Phoenix Suns' },
  { id: 1610612757, code: 'POR', name: 'Portland Trail Blazers' },
  { id: 1610612758, code: 'SAC', name: 'Sacramento Kings' },
  { id: 1610612759, code: 'SAS', name: 'San Antonio Spurs', espn: 'SA' },
  { id: 1610612761, code: 'TOR', name: 'Toronto Raptors' },
  { id: 1610612762, code: 'UTA', name: 'Utah Jazz', espn: 'UTAH' },
  { id: 1610612764, code: 'WAS', name: 'Washington Wizards', espn: 'WSH' },
];

const byId = new Map(NBA_TEAMS.map((t) => [t.id, t]));
const byCode = new Map(NBA_TEAMS.map((t) => [t.code, t]));
const byEspnCode = new Map(NBA_TEAMS.map((t) => [t.espn ?? t.code, t]));

export const nbaTeamById = (id: number) => byId.get(id);
export const nbaTeamByCode = (code: string) => byCode.get(code);
export const nbaTeamByEspnCode = (code: string) => byEspnCode.get(code);

/** Indice 1-30 della squadra. */
export const teamIndex = (team: NbaTeam) => NBA_TEAMS.indexOf(team) + 1;
export const teamAtIndex = (index: number) => NBA_TEAMS[index - 1];

/**
 * Logo PNG di ESPN (`det.png`, `gs.png`…). Quello ufficiale NBA è solo SVG e ha lo stesso nome (`logo.svg`) per ogni squadra:
 * non va bene né come chiave del manifest immagini (ultimo segmento dell'URL) né per `cwebp`. Va tenuto uguale a `scripts/download-images.mjs`.
 */
export const logoUrl = (team: NbaTeam) => `https://a.espncdn.com/i/teamlogos/nba/500/${(team.espn ?? team.code).toLowerCase()}.png`;
