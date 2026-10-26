import { BoxScorePlayer, BoxScoreSide, GameStats, Match, MatchStatus, Player, TeamRef } from '../../domain/entities';
import { liveLabel } from '../../domain/liveLabel';
import { EspnBoxScoreAthleteDto, EspnBoxScoreSideDto, EspnEventDto, EspnRosterAthleteDto, EspnTeamDto } from './dto';
import { easternDate, weekOf } from './weeks';

const CM_PER_INCH = 2.54;
const KG_PER_POUND = 0.45359237;

/**
 * Il suffisso `?wnba` evita che il logo o la foto coincidano con un'immagine NBA inclusa nell'app: il manifest delle immagini
 * usa l'ultimo segmento dell'URL come chiave (`atl.png` è anche l'Atlanta Hawks).
 */
export const logoUrl = (team: EspnTeamDto) => `https://a.espncdn.com/i/teamlogos/wnba/500/${team.abbreviation.toLowerCase()}.png?wnba`;
export const headshotUrl = (athleteId: string) => `https://a.espncdn.com/i/headshots/wnba/players/full/${athleteId}.png?wnba`;

export const toTeamRef = (team: EspnTeamDto): TeamRef => ({
  id: Number(team.id),
  name: team.displayName,
  code: team.abbreviation,
  logoUrl: logoUrl(team),
});

const STATES: Record<string, MatchStatus> = { pre: 'scheduled', in: 'live', post: 'finished' };

/** Partite rinviate o annullate: ESPN le segna "post" ma non sono state giocate. */
const NOT_PLAYED = new Set(['STATUS_POSTPONED', 'STATUS_CANCELED', 'STATUS_SUSPENDED']);

/** Regular Season che conta in classifica: niente precampionato, playoff, All-Star Game e finale della Commissioner's Cup. */
export const isRegularSeasonGame = (event: EspnEventDto) =>
  event.season.type === 2 && event.competitions[0]?.type.abbreviation === 'STD';

/** `displayClock` di ESPN ("5:32", "45.3" sotto il minuto) in secondi. */
function clockSeconds(display: string): number {
  const [minutes, seconds] = display.includes(':') ? display.split(':') : ['0', display];
  return (Number(minutes) || 0) * 60 + (Number(seconds) || 0);
}

export function toMatch(competition: number, firstMonday: number, event: EspnEventDto): Match | null {
  const game = event.competitions[0];
  const home = game.competitors.find((c) => c.homeAway === 'home');
  const away = game.competitors.find((c) => c.homeAway === 'away');
  if (!home || !away || NOT_PLAYED.has(game.status.type.name)) return null;

  const status = STATES[game.status.type.state] ?? 'scheduled';
  const started = status !== 'scheduled';
  const week = weekOf(firstMonday, easternDate(event.date));
  return {
    id: Number(event.id),
    status,
    startsAt: new Date(event.date),
    home: toTeamRef(home.team),
    away: toTeamRef(away.team),
    homeScore: started ? Number(home.score) || 0 : null,
    awayScore: started ? Number(away.score) || 0 : null,
    venue: game.venue?.fullName || null,
    city: game.venue?.address?.city || null,
    dayNumber: week,
    dayName: `Settimana ${week}`,
    hasStreaming: false,
    liveLabel: status === 'live' ? liveLabel(game.status.period, clockSeconds(game.status.displayClock)) : null,
  };
}

/** "33-67" → [33, 67]. */
const madeAttempted = (value: string | undefined): [number, number] => {
  const [made, attempted] = (value ?? '').split('-').map(Number);
  return [made || 0, attempted || 0];
};

/**
 * ESPN non pubblica falli subiti né stoppate subite (restano 0); il box score non li ha. Valutazione come la EuroLeague (PIR):
 * punti + rimbalzi + assist + recuperi + stoppate − tiri sbagliati (dal campo e liberi) − palle perse − falli fatti.
 */
function toGameStats(keys: string[], values: string[]): GameStats {
  const get = (key: string) => values[keys.indexOf(key)];
  const num = (key: string) => Number(get(key)) || 0;
  const [fgMade, fgAttempted] = madeAttempted(get('fieldGoalsMade-fieldGoalsAttempted'));
  const [threeMade, threeAttempted] = madeAttempted(get('threePointFieldGoalsMade-threePointFieldGoalsAttempted'));
  const [ftMade, ftAttempted] = madeAttempted(get('freeThrowsMade-freeThrowsAttempted'));
  const stats: Omit<GameStats, 'rating'> = {
    minutes: Math.floor(num('minutes')),
    points: num('points'),
    fouls: num('fouls'),
    foulsDrawn: 0,
    twoMade: fgMade - threeMade,
    twoAttempted: fgAttempted - threeAttempted,
    threeMade,
    threeAttempted,
    freeThrowsMade: ftMade,
    freeThrowsAttempted: ftAttempted,
    offensiveRebounds: num('offensiveRebounds'),
    defensiveRebounds: num('defensiveRebounds'),
    totalRebounds: num('rebounds'),
    assists: num('assists'),
    steals: num('steals'),
    turnovers: num('turnovers'),
    blocks: num('blocks'),
    blocksAgainst: 0,
  };
  const rating =
    stats.points + stats.totalRebounds + stats.assists + stats.steals + stats.blocks -
    (fgAttempted - fgMade) - (ftAttempted - ftMade) - stats.turnovers - stats.fouls;
  return { ...stats, rating };
}

/** "+3" → 3. */
const plusMinus = (keys: string[], values: string[]) => Number(values[keys.indexOf('plusMinus')]) || 0;

function toBoxScorePlayer(keys: string[], entry: EspnBoxScoreAthleteDto): BoxScorePlayer {
  const { athlete } = entry;
  const [firstName, ...rest] = athlete.displayName.split(' ');
  return {
    id: Number(athlete.id),
    firstName: athlete.firstName ?? firstName,
    lastName: athlete.lastName ?? rest.join(' '),
    number: athlete.jersey || '-',
    photoUrl: headshotUrl(athlete.id),
    starter: entry.starter,
    plusMinus: plusMinus(keys, entry.stats),
    stats: toGameStats(keys, entry.stats),
  };
}

export function toBoxScoreSide(side: EspnBoxScoreSideDto): BoxScoreSide {
  const table = side.statistics[0];
  const players = table.athletes.filter((a) => !a.didNotPlay && a.stats.length > 0);
  return { players: players.map((a) => toBoxScorePlayer(table.keys, a)), totals: toGameStats(table.keys, table.totals) };
}

const ROLES: Record<string, string> = { G: 'Guardia', F: 'Ala', C: 'Centro' };

/** "G-F" → "Guardia/Ala". */
const role = (position: string) => position.split('-').map((p) => ROLES[p] ?? p).join('/');

export function toPlayer(athlete: EspnRosterAthleteDto, team: TeamRef): Player {
  const place = athlete.birthPlace;
  return {
    id: Number(athlete.id),
    firstName: athlete.firstName,
    lastName: athlete.lastName,
    number: athlete.jersey || '-',
    role: role(athlete.position?.abbreviation ?? ''),
    country: place?.country ?? '',
    birthDate: athlete.dateOfBirth?.slice(0, 10) ?? null,
    birthPlace: [place?.city, place?.state].filter(Boolean).join(', ') || null,
    heightCm: athlete.height ? Math.round(athlete.height * CM_PER_INCH) : null,
    weightKg: athlete.weight ? Math.round(athlete.weight * KG_PER_POUND) : null,
    photoUrl: headshotUrl(athlete.id),
    teamId: team.id,
    teamName: team.name,
  };
}
