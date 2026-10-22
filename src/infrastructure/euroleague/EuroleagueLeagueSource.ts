import { Competition, Match, MatchBoxScore, Roster, TeamRef } from '../../domain/entities';
import { LeagueSource } from '../../domain/ports';
import { HttpClient, HttpError } from '../api/HttpClient';
import { BoxScoreResponseDto, ClubDto, GameDto, GamesResponseDto, LiveBoxScoreDto, LiveHeaderDto, PersonRoleDto } from './dto';
import { clubId, competitionId, decodeCompetitionId, decodeMatchId, seasonCode } from './ids';
import { toBoxScoreSide, toCoach, toLiveBoxScore, toMatch, toPlayer, toTeamRef } from './mappers';
import { EuroleagueSeries } from './series';

const API_URL = 'https://api-live.euroleague.net/v2/competitions';
/**
 * Feed del sito live (non documentato): l'API v2 tiene punteggio a 0 e box score vuoto finché la partita non è conclusa,
 * questo invece si aggiorna durante la partita.
 */
const LIVE_URL = 'https://live.euroleague.net/api';

/** Una stagione ha al più qualche centinaio di partite: una pagina basta. */
const PAGE_SIZE = 500;

/**
 * L'API (dietro Cloudflare) limita le richieste e, superato il limite, risponde 429 con un'attesa che può arrivare a minuti:
 * le richieste partono una alla volta, distanziate; un'attesa breve si aspetta, una lunga fa fallire subito
 * (la sincronizzazione riprova al prossimo aggiornamento) invece di bloccare l'app.
 */
const MIN_GAP_MS = 500;
const MAX_WAIT_MS = 15_000;
const DEFAULT_RETRY_AFTER_MS = 8_000;
const MAX_ATTEMPTS = 3;
/** Il calendario di tutta la stagione è un'unica risposta: giornate e gironi la condividono per questo tempo. */
const SEASON_TTL_MS = 10_000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * EuroLeague ed EuroCup dall'API ufficiale di Euroleague Basketball. Ogni girone è una competizione
 * (la EuroLeague ne ha uno, la EuroCup quattro) e le giornate sono i "round" della fase a gironi.
 */
export class EuroleagueLeagueSource implements LeagueSource {
  /** Elenco dei club della stagione: serve a risalire dall'id numerico della squadra al codice dell'API. */
  private clubs: Promise<Map<number, ClubDto>> | null = null;
  private season: { year: number; at: number; games: Promise<GameDto[]> } | null = null;
  /** Coda delle richieste in attesa del loro turno. */
  private queue: Promise<void> = Promise.resolve();
  private nextSlot = 0;
  /** Ultimo 429 ricevuto: fino a `until` il server rifiuta ogni richiesta. */
  private blocked: { until: number; error: HttpError } | null = null;

  constructor(
    private readonly http: HttpClient,
    private readonly series: EuroleagueSeries,
    private readonly seasonYear: () => number,
  ) {}

  async findRegularSeasons(seasonYear: number): Promise<Competition[]> {
    const games = await this.regularSeasonGames(seasonYear);
    const names = new Map<number, string>();
    for (const { group } of games) names.set(group.order, group.rawName);
    const groups = [...names].sort(([a], [b]) => a - b);
    return groups.map(([order, rawName]) => ({
      id: competitionId(seasonYear, order),
      name: groups.length === 1 ? this.series.name : `Girone ${rawName}`,
      year: seasonYear,
    }));
  }

  async getDay(competition: number, dayNumber: number): Promise<Match[]> {
    const { seasonYear, groupOrder } = decodeCompetitionId(competition);
    const games = await this.regularSeasonGames(seasonYear);
    const now = Date.now();
    const day = games.filter((g) => g.group.order === groupOrder && g.round === dayNumber);
    return Promise.all(
      day.map(async (g) => {
        const match = toMatch(g, competition, now);
        if (match.status !== 'live') return match;
        const score = await this.liveScore(seasonYear, g.gameCode);
        return score ? toMatch(g, competition, now, score) : match;
      }),
    );
  }

  async getBoxScore(id: number): Promise<MatchBoxScore> {
    const { seasonYear, gameCode } = decodeMatchId(id);
    const dto = await this.get<BoxScoreResponseDto>(`${this.seasonUrl(seasonYear)}/games/${gameCode}/stats`);
    const box = { home: toBoxScoreSide(dto.local), away: toBoxScoreSide(dto.road) };
    if (box.home.players.length + box.away.players.length > 0) return box;
    return (await this.liveBoxScore(seasonYear, gameCode)) ?? box;
  }

  private liveParams(seasonYear: number, gameCode: number) {
    return { gamecode: gameCode, seasoncode: seasonCode(this.series.code, seasonYear) };
  }

  /** Punteggio dal feed live; null se non disponibile (si resta con quello dell'API v2). */
  private async liveScore(seasonYear: number, gameCode: number): Promise<{ home: number; away: number } | null> {
    try {
      const header = await this.http.get<LiveHeaderDto>(`${LIVE_URL}/Header`, this.liveParams(seasonYear, gameCode));
      const home = Number(header.ScoreA);
      const away = Number(header.ScoreB);
      return Number.isFinite(home) && Number.isFinite(away) ? { home, away } : null;
    } catch {
      return null;
    }
  }

  private async liveBoxScore(seasonYear: number, gameCode: number): Promise<MatchBoxScore | null> {
    try {
      return toLiveBoxScore(await this.http.get<LiveBoxScoreDto>(`${LIVE_URL}/Boxscore`, this.liveParams(seasonYear, gameCode)));
    } catch {
      return null;
    }
  }

  async getRoster(teamId: number): Promise<Roster> {
    const club = (await this.loadClubs()).get(teamId);
    if (!club) throw new Error(`Squadra ${teamId} non trovata`);

    const team: TeamRef = toTeamRef(club);
    const people = await this.get<PersonRoleDto[]>(`${this.seasonUrl(this.seasonYear())}/clubs/${club.code}/people`);
    const active = people.filter((p) => p.active);
    const coach = active.find((p) => p.type === 'E');
    return {
      team,
      coach: coach ? toCoach(coach) : null,
      players: active.filter((p) => p.type === 'J').map((p) => toPlayer(p, team)),
    };
  }

  /** Fallisce subito se il server ha imposto un'attesa lunga; altrimenti aspetta il proprio turno. */
  private async turn(): Promise<void> {
    this.failIfBlocked();
    const ticket = this.queue.then(async () => {
      this.failIfBlocked();
      const wait = Math.max(this.nextSlot, this.blocked?.until ?? 0) - Date.now();
      if (wait > 0) await sleep(wait);
      this.nextSlot = Date.now() + MIN_GAP_MS;
    });
    // Un rifiuto in coda non deve bloccare chi viene dopo: ognuno rivaluta il blocco al proprio turno.
    this.queue = ticket.catch(() => {});
    await ticket;
  }

  private failIfBlocked() {
    if (this.blocked && this.blocked.until - Date.now() > MAX_WAIT_MS) throw this.blocked.error;
  }

  private async get<T>(url: string, params?: Record<string, number>): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      await this.turn();
      try {
        return await this.http.get<T>(url, params);
      } catch (error) {
        if (!(error instanceof HttpError) || error.status !== 429) throw error;
        this.blocked = { until: Date.now() + (error.retryAfterMs ?? DEFAULT_RETRY_AFTER_MS), error };
        if (attempt >= MAX_ATTEMPTS) throw error;
      }
    }
  }

  private seasonUrl(seasonYear: number) {
    return `${API_URL}/${this.series.code}/seasons/${seasonCode(this.series.code, seasonYear)}`;
  }

  /** Partite della fase a gironi di tutta la stagione. */
  private regularSeasonGames(seasonYear: number): Promise<GameDto[]> {
    const now = Date.now();
    if (this.season?.year === seasonYear && now - this.season.at < SEASON_TTL_MS) return this.season.games;

    const games = this.get<GamesResponseDto>(`${this.seasonUrl(seasonYear)}/games`, { limit: PAGE_SIZE }).then((response) =>
      response.data.filter((g) => g.phaseType.code === 'RS'),
    );
    const entry = { year: seasonYear, at: now, games };
    this.season = entry;
    games.catch(() => {
      if (this.season === entry) this.season = null;
    });
    return games;
  }

  private loadClubs(): Promise<Map<number, ClubDto>> {
    this.clubs ??= this
      .get<{ data: ClubDto[] }>(`${this.seasonUrl(this.seasonYear())}/clubs`, { limit: PAGE_SIZE })
      .then((response) => new Map(response.data.map((club) => [clubId(club.code), club])))
      .catch((error) => {
        this.clubs = null;
        throw error;
      });
    return this.clubs;
  }
}
