import { Competition, Match, MatchBoxScore, MatchStatus, Roster } from '../../domain/entities';
import { LeagueSource } from '../../domain/ports';
import { HttpClient } from '../api/HttpClient';
import { competitionId } from './ids';
import { toMatch } from './mappers';
import { nbaTeamByEspnCode } from './teams';
import { datesOfWeek, REGULAR_SEASON_WEEKS } from './weeks';

const SCOREBOARD_URL = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard';

/** Una risposta per giorno: durante le partite la stessa giornata viene riletta spesso, quindi si tiene per poco. */
const DAY_TTL_MS = 10_000;

interface EspnCompetitorDto {
  homeAway: 'home' | 'away';
  score?: string;
  team: { abbreviation: string };
}

interface EspnEventDto {
  date: string;
  season: { type: number };
  competitions: {
    competitors: EspnCompetitorDto[];
    venue?: { fullName?: string; address?: { city?: string } };
    notes?: { headline?: string }[];
    status: { period: number; displayClock: string; type: { state: 'pre' | 'in' | 'post' } };
  }[];
}

interface EspnScoreboardDto {
  events: EspnEventDto[];
}

/** `displayClock` di ESPN ("5:32", "45.3" sotto il minuto) come durata ISO, la forma che usa il feed della NBA. */
function espnClock(display: string): string {
  const [minutes, seconds] = display.includes(':') ? display.split(':') : ['0', display];
  return `PT${Number(minutes) || 0}M${Number(seconds) || 0}S`;
}

const STATES: Record<string, MatchStatus> = { pre: 'scheduled', in: 'live', post: 'finished' };

/** Turni a eliminazione della NBA Cup: non contano nella Regular Season. */
const CUP_KNOCKOUT = /NBA Cup - (Quarter|Semi|Champ)/i;

/**
 * Backup per NBA: calendario, stato e punteggi (anche in diretta) dal tabellone di ESPN, senza chiave né protezioni.
 * Gli id delle partite si ricavano da data e squadre (vedi `ids.ts`), quindi coincidono con quelli della fonte principale.
 * ESPN usa id propri per giocatori e squadre e il suo box score non si può associare ai giocatori NBA già nel database:
 * box score e roster non sono disponibili.
 */
export class NbaEspnLeagueSource implements LeagueSource {
  private readonly days = new Map<string, { at: number; events: Promise<EspnEventDto[]> }>();

  constructor(private readonly http: HttpClient) {}

  async findRegularSeasons(seasonYear: number): Promise<Competition[]> {
    return [{ id: competitionId(seasonYear), name: 'NBA', year: seasonYear, totalDays: REGULAR_SEASON_WEEKS }];
  }

  async getDay(competition: number, dayNumber: number): Promise<Match[]> {
    const seasonYear = 2000 + Math.floor(competition / 10);
    const perDay = await Promise.all(datesOfWeek(seasonYear, dayNumber).map(async (date) => ({ date, events: await this.day(date) })));
    return perDay.flatMap(({ date, events }) => events.flatMap((event) => toMatches(competition, seasonYear, date, event)));
  }

  async getBoxScore(): Promise<MatchBoxScore> {
    throw new Error('Box score non disponibile dal backup NBA');
  }

  async getRoster(): Promise<Roster> {
    throw new Error('Roster non disponibile dal backup NBA');
  }

  /** Partite di un giorno (AAAAMMGG, ora della costa Est: ESPN le raggruppa così). */
  private day(date: string): Promise<EspnEventDto[]> {
    const now = Date.now();
    const known = this.days.get(date);
    if (known && now - known.at < DAY_TTL_MS) return known.events;

    const events = this.http.get<EspnScoreboardDto>(SCOREBOARD_URL, { dates: date }).then((dto) => dto.events);
    const entry = { at: now, events };
    this.days.set(date, entry);
    events.catch(() => {
      if (this.days.get(date) === entry) this.days.delete(date);
    });
    return events;
  }
}

function toMatches(competition: number, seasonYear: number, date: string, event: EspnEventDto): Match[] {
  // season.type 2 = Regular Season (1 = precampionato, 3 = playoff).
  if (event.season.type !== 2) return [];
  const game = event.competitions[0];
  if (game.notes?.some((n) => CUP_KNOCKOUT.test(n.headline ?? ''))) return [];

  const home = game.competitors.find((c) => c.homeAway === 'home');
  const away = game.competitors.find((c) => c.homeAway === 'away');
  const homeTeam = home && nbaTeamByEspnCode(home.team.abbreviation);
  const awayTeam = away && nbaTeamByEspnCode(away.team.abbreviation);
  // Le partite con squadre ancora da definire ("TBD") non hanno una squadra NBA.
  if (!home || !away || !homeTeam || !awayTeam) return [];

  return [
    toMatch(
      competition,
      seasonYear,
      date,
      homeTeam,
      awayTeam,
      STATES[game.status.type.state] ?? 'scheduled',
      new Date(event.date),
      { home: Number(home.score) || 0, away: Number(away.score) || 0 },
      game.venue?.fullName ? { name: game.venue.fullName, city: game.venue.address?.city ?? '' } : null,
      { period: game.status.period, clock: espnClock(game.status.displayClock) },
    ),
  ];
}
