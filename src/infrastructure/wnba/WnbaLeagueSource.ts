import { Competition, Match, MatchBoxScore, Roster } from '../../domain/entities';
import { LeagueSource } from '../../domain/ports';
import { HttpClient } from '../api/HttpClient';
import { EspnRosterDto, EspnScoreboardDto, EspnSummaryDto } from './dto';
import { isRegularSeasonGame, toBoxScoreSide, toMatch, toPlayer, toTeamRef } from './mappers';
import { datesOfWeek, easternDate, mondayOf, weekOf } from './weeks';

const BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/basketball/wnba';

/** Una risposta per giorno: durante le partite la stessa giornata viene riletta spesso, quindi si tiene per poco. */
const DAY_TTL_MS = 10_000;
/** La stagione (prima e ultima partita) cambia solo se la lega sposta le date. */
const SEASON_TTL_MS = 60 * 60_000;

/** Come ESPN numera le settimane della stagione: dal lunedì della prima partita. */
interface SeasonWeeks {
  firstMonday: number;
  totalWeeks: number;
}

/** Cache di una risposta che dopo un errore non resta in memoria: il tentativo successivo riparte da zero. */
class TtlCache<T> {
  private readonly entries = new Map<string, { at: number; value: Promise<T> }>();

  constructor(private readonly ttlMs: number) {}

  get(key: string, load: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const known = this.entries.get(key);
    if (known && now - known.at < this.ttlMs) return known.value;

    const entry = { at: now, value: load() };
    this.entries.set(key, entry);
    entry.value.catch(() => {
      if (this.entries.get(key) === entry) this.entries.delete(key);
    });
    return entry.value;
  }
}

/** Id della competizione: come per le altre leghe, anno a 2 cifre per 10 (+ girone, qui sempre 1). */
const competitionId = (seasonYear: number) => (seasonYear % 100) * 10 + 1;

/**
 * WNBA dal tabellone, dal riepilogo partita e dal roster di ESPN, senza chiave né protezioni. Le "giornate" sono le settimane.
 * Gli id di partite, squadre e giocatori sono quelli di ESPN. Il campionato non ha una seconda fonte: la NBA pubblica la WNBA
 * sullo stesso CDN della NBA, ma protetto da controlli sul client (vedi `docs/api-nba.md`).
 */
export class WnbaLeagueSource implements LeagueSource {
  private readonly seasons = new TtlCache<SeasonWeeks>(SEASON_TTL_MS);
  private readonly days = new TtlCache<EspnScoreboardDto['events']>(DAY_TTL_MS);

  constructor(private readonly http: HttpClient) {}

  async findRegularSeasons(seasonYear: number): Promise<Competition[]> {
    const { totalWeeks } = await this.season(seasonYear);
    return [{ id: competitionId(seasonYear), name: 'WNBA', year: seasonYear, totalDays: totalWeeks }];
  }

  async getDay(competition: number, dayNumber: number): Promise<Match[]> {
    const seasonYear = 2000 + Math.floor(competition / 10);
    const { firstMonday } = await this.season(seasonYear);
    const perDay = await Promise.all(datesOfWeek(firstMonday, dayNumber).map((date) => this.day(date)));
    return perDay
      .flat()
      .filter(isRegularSeasonGame)
      .flatMap((event) => toMatch(competition, firstMonday, event) ?? []);
  }

  async getBoxScore(matchId: number): Promise<MatchBoxScore> {
    const dto = await this.http.get<EspnSummaryDto>(`${BASE_URL}/summary`, { event: String(matchId) });
    const sides = dto.boxscore.players ?? [];
    // Prima della palla a due il riepilogo non ha giocatori.
    if (sides.length === 0) return emptyBoxScore();

    const competitors = dto.header.competitions[0].competitors;
    const side = (homeAway: 'home' | 'away') => {
      const teamId = competitors.find((c) => c.homeAway === homeAway)?.team.id;
      const found = sides.find((s) => s.team.id === teamId);
      return found ? toBoxScoreSide(found) : emptyBoxScore().home;
    };
    return { home: side('home'), away: side('away') };
  }

  async getRoster(teamId: number): Promise<Roster> {
    const dto = await this.http.get<EspnRosterDto>(`${BASE_URL}/teams/${teamId}/roster`);
    const team = toTeamRef(dto.team);
    const coach = dto.coach?.[0];
    return {
      team,
      coach: coach ? { id: Number(coach.id), firstName: coach.firstName, lastName: coach.lastName, photoUrl: null } : null,
      players: dto.athletes.map((athlete) => toPlayer(athlete, team)),
    };
  }

  /**
   * Prima e ultima partita di Regular Season, da cui il numero delle settimane. Una sola richiesta per l'intero anno
   * (alcuni MB: tutte le partite, playoff compresi), quindi tenuta in memoria a lungo.
   */
  private season(seasonYear: number): Promise<SeasonWeeks> {
    return this.seasons.get(String(seasonYear), async () => {
      const dto = await this.http.get<EspnScoreboardDto>(`${BASE_URL}/scoreboard`, { dates: String(seasonYear), limit: '1000' });
      const dates = dto.events.filter(isRegularSeasonGame).map((event) => easternDate(event.date)).sort();
      if (dates.length === 0) throw new Error(`Calendario WNBA ${seasonYear} non ancora pubblicato`);
      const firstMonday = mondayOf(dates[0]);
      return { firstMonday, totalWeeks: weekOf(firstMonday, dates[dates.length - 1]) };
    });
  }

  /** Partite di un giorno (AAAAMMGG, ora della costa Est: ESPN le raggruppa così). */
  private day(date: string) {
    return this.days.get(date, async () => (await this.http.get<EspnScoreboardDto>(`${BASE_URL}/scoreboard`, { dates: date })).events);
  }
}

const EMPTY_STATS = {
  minutes: 0,
  points: 0,
  fouls: 0,
  foulsDrawn: 0,
  twoMade: 0,
  twoAttempted: 0,
  threeMade: 0,
  threeAttempted: 0,
  freeThrowsMade: 0,
  freeThrowsAttempted: 0,
  offensiveRebounds: 0,
  defensiveRebounds: 0,
  totalRebounds: 0,
  assists: 0,
  steals: 0,
  turnovers: 0,
  blocks: 0,
  blocksAgainst: 0,
  rating: 0,
};

const emptyBoxScore = (): MatchBoxScore => ({
  home: { players: [], totals: EMPTY_STATS },
  away: { players: [], totals: EMPTY_STATS },
});
