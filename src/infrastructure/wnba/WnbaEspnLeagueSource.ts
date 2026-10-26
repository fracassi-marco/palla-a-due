import { Competition, Match, MatchBoxScore, MatchStatus, Roster } from '../../domain/entities';
import { LeagueSource } from '../../domain/ports';
import { HttpClient } from '../api/HttpClient';
import { EspnEventDto, EspnScoreboardDto } from './dto';
import { competitionId } from './ids';
import { toMatch } from './mappers';
import { wnbaTeamByEspnCode } from './teams';
import { TtlCache } from './TtlCache';
import { datesOfWeek, easternDate, mondayOf, weekOf } from './weeks';

const SCOREBOARD_URL = 'https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/scoreboard';

/** Una risposta per giorno: durante le partite la stessa giornata viene riletta spesso, quindi si tiene per poco. */
const DAY_TTL_MS = 10_000;
/** La stagione (prima e ultima partita) cambia solo se la lega sposta le date. */
const SEASON_TTL_MS = 60 * 60_000;

/** Come la fonte principale numera le settimane della stagione: dal lunedì della prima partita. */
interface SeasonWeeks {
  firstMonday: number;
  totalWeeks: number;
}

/** `displayClock` di ESPN ("5:32", "45.3" sotto il minuto) come durata ISO, la forma che usa il feed della NBA. */
function espnClock(display: string): string {
  const [minutes, seconds] = display.includes(':') ? display.split(':') : ['0', display];
  return `PT${Number(minutes) || 0}M${Number(seconds) || 0}S`;
}

const STATES: Record<string, MatchStatus> = { pre: 'scheduled', in: 'live', post: 'finished' };

/** Partite rinviate o annullate: ESPN le segna "post" ma non sono state giocate. */
const NOT_PLAYED = new Set(['STATUS_POSTPONED', 'STATUS_CANCELED', 'STATUS_SUSPENDED']);

/** Regular Season che conta in classifica: niente precampionato, playoff, All-Star Game e finale della Commissioner's Cup. */
const isRegularSeasonGame = (event: EspnEventDto) => event.season.type === 2 && event.competitions[0]?.type.abbreviation === 'STD';

/**
 * Backup per WNBA: calendario, stato e punteggi (anche in diretta) dal tabellone di ESPN, senza chiave né protezioni.
 * Gli id delle partite si ricavano da data e squadre (vedi `ids.ts`), quindi coincidono con quelli della fonte principale.
 * ESPN usa id propri per giocatori e squadre e il suo box score non si può associare ai giocatori già nel database:
 * box score e roster non sono disponibili.
 */
export class WnbaEspnLeagueSource implements LeagueSource {
  private readonly seasons = new TtlCache<SeasonWeeks>(SEASON_TTL_MS);
  private readonly days = new TtlCache<EspnEventDto[]>(DAY_TTL_MS);

  constructor(private readonly http: HttpClient) {}

  async findRegularSeasons(seasonYear: number): Promise<Competition[]> {
    const { totalWeeks } = await this.season(seasonYear);
    return [{ id: competitionId(seasonYear), name: 'WNBA', year: seasonYear, totalDays: totalWeeks }];
  }

  async getDay(competition: number, dayNumber: number): Promise<Match[]> {
    const seasonYear = 2000 + Math.floor(competition / 10);
    const { firstMonday } = await this.season(seasonYear);
    const perDay = await Promise.all(datesOfWeek(firstMonday, dayNumber).map(async (date) => ({ date, events: await this.day(date) })));
    return perDay.flatMap(({ date, events }) => events.flatMap((event) => toMatches(competition, firstMonday, date, event)));
  }

  async getBoxScore(): Promise<MatchBoxScore> {
    throw new Error('Box score non disponibile dal backup WNBA');
  }

  async getRoster(): Promise<Roster> {
    throw new Error('Roster non disponibile dal backup WNBA');
  }

  /**
   * Prima e ultima partita di Regular Season, da cui il numero delle settimane. Una sola richiesta per l'intero anno
   * (alcuni MB: tutte le partite, playoff compresi), quindi tenuta in memoria a lungo.
   */
  private season(seasonYear: number): Promise<SeasonWeeks> {
    return this.seasons.get(String(seasonYear), async () => {
      const dto = await this.http.get<EspnScoreboardDto>(SCOREBOARD_URL, { dates: String(seasonYear), limit: '1000' });
      const dates = dto.events.filter(isRegularSeasonGame).map((event) => easternDate(event.date)).sort();
      if (dates.length === 0) throw new Error(`Calendario WNBA ${seasonYear} non ancora pubblicato`);
      const firstMonday = mondayOf(dates[0]);
      return { firstMonday, totalWeeks: weekOf(firstMonday, dates[dates.length - 1]) };
    });
  }

  /** Partite di un giorno (AAAAMMGG, ora della costa Est: ESPN le raggruppa così). */
  private day(date: string): Promise<EspnEventDto[]> {
    return this.days.get(date, async () => (await this.http.get<EspnScoreboardDto>(SCOREBOARD_URL, { dates: date })).events);
  }
}

function toMatches(competition: number, firstMonday: number, date: string, event: EspnEventDto): Match[] {
  if (!isRegularSeasonGame(event)) return [];
  const game = event.competitions[0];
  if (NOT_PLAYED.has(game.status.type.name)) return [];

  const home = game.competitors.find((c) => c.homeAway === 'home');
  const away = game.competitors.find((c) => c.homeAway === 'away');
  const homeTeam = home && wnbaTeamByEspnCode(home.team.abbreviation);
  const awayTeam = away && wnbaTeamByEspnCode(away.team.abbreviation);
  // Una squadra che non è tra le 15 note (un'espansione) non ha un id: la partita si salta.
  if (!home || !away || !homeTeam || !awayTeam) return [];

  return [
    toMatch(
      competition,
      firstMonday,
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
