import { currentSeasonYear } from '../../application/season';
import { Competition, Match, MatchBoxScore, MatchStatus, Roster } from '../../domain/entities';
import { LeagueSource } from '../../domain/ports';
import { HttpClient } from '../api/HttpClient';
import { BoxScoreDto, PlayerIndexDto, ScheduleDto, ScheduleGameDto, ScoreboardDto, ScoreboardGameDto } from './dto';
import { competitionId, decodeMatchId, gameCode } from './ids';
import { gameDate, STATUSES, toBoxScoreSide, toMatch, toPlayer, toTeamRef } from './mappers';
import { nbaTeamById } from './teams';
import { weekOf } from './weeks';

const CDN_URL = 'https://cdn.nba.com/static/json';

/**
 * Il CDN (Akamai) risponde 403 ai client che non sembrano un browser: servono un User-Agent di Chrome e le intestazioni
 * che un browser manda a una richiesta cross-origin da nba.com. Verificato il 22/10/2026 con curl: tolta una qualunque
 * tra Accept-Language, Accept-Encoding, Referer, sec-fetch-mode, sec-fetch-site, sec-ch-ua (o con un altro User-Agent)
 * risponde 403. Origin e Accept non servono.
 */
export const NBA_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept: '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  Referer: 'https://www.nba.com/',
  Origin: 'https://www.nba.com',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-site',
  'sec-ch-ua': '"Chromium";v="126"',
};

/**
 * Il calendario di tutta la stagione pesa ~7 MB (400 KB compressi): una sola copia condivisa da giornate e box score.
 * Durante le partite punteggio e stato vengono dal tabellone del giorno (35 KB), che è molto più leggero da rileggere.
 */
const SCHEDULE_TTL_MS = 2 * 60_000;
const SCOREBOARD_TTL_MS = 10_000;
/** L'anagrafica dei giocatori (280 KB) cambia solo con le firme e i tagli. */
const PLAYER_INDEX_TTL_MS = 60 * 60_000;
const HOUR_MS = 60 * 60_000;

/** Partite a eliminazione della NBA Cup: non contano nella Regular Season (e a calendario hanno squadre ancora da definire). */
const CUP_KNOCKOUT = new Set(['Quarterfinal', 'Semifinal', 'Championship']);

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
const EMPTY_BOX: MatchBoxScore = {
  home: { players: [], totals: EMPTY_STATS },
  away: { players: [], totals: EMPTY_STATS },
};

interface Cached<T> {
  at: number;
  value: Promise<T>;
}

/** Cache di una risposta che dopo un errore non resta in memoria: il tentativo successivo riparte da zero. */
function cached<T>(slot: Cached<T> | null, ttl: number, load: () => Promise<T>, store: (entry: Cached<T> | null) => void): Promise<T> {
  const now = Date.now();
  if (slot && now - slot.at < ttl) return slot.value;
  const entry: Cached<T> = { at: now, value: load() };
  store(entry);
  entry.value.catch(() => store(null));
  return entry.value;
}

/** NBA dal CDN ufficiale (calendario, box score anche in diretta, anagrafica giocatori). Le "giornate" sono le settimane. */
export class NbaLeagueSource implements LeagueSource {
  private schedule: Cached<ScheduleGameDto[]> & { year: number } | null = null;
  private scoreboard: Cached<Map<string, ScoreboardGameDto>> | null = null;
  private players: Cached<Record<string, string | number | null>[]> | null = null;

  constructor(private readonly http: HttpClient) {}

  async findRegularSeasons(seasonYear: number): Promise<Competition[]> {
    const games = await this.regularSeasonGames(seasonYear);
    const totalDays = Math.max(...games.map((g) => weekOf(seasonYear, gameDate(g))));
    return [{ id: competitionId(seasonYear), name: 'NBA', year: seasonYear, totalDays }];
  }

  async getDay(competition: number, dayNumber: number): Promise<Match[]> {
    const seasonYear = 2000 + Math.floor(competition / 10);
    const day = (await this.regularSeasonGames(seasonYear)).filter((g) => weekOf(seasonYear, gameDate(g)) === dayNumber);
    const live = await this.liveGames(day);
    return day.map((game) => {
      const home = nbaTeamById(game.homeTeam.teamId)!;
      const away = nbaTeamById(game.awayTeam.teamId)!;
      const update = live.get(game.gameId);
      const status = this.statusOf(game, update);
      const score = update ?? game;
      return toMatch(
        competition,
        seasonYear,
        gameDate(game),
        home,
        away,
        status,
        new Date(game.gameDateTimeUTC),
        { home: score.homeTeam.score, away: score.awayTeam.score },
        { name: game.arenaName, city: game.arenaCity },
        update && { period: update.period, clock: update.gameClock },
      );
    });
  }

  async getBoxScore(id: number): Promise<MatchBoxScore> {
    const { date, home, away } = decodeMatchId(id);
    const seasonYear = currentSeasonYear(new Date(Number(date.slice(0, 4)), Number(date.slice(4, 6)) - 1, Number(date.slice(6, 8))));
    const code = gameCode(date, home, away);
    const game = (await this.regularSeasonGames(seasonYear)).find((g) => g.gameCode === code);
    if (!game) throw new Error(`Partita ${code} non trovata nel calendario NBA`);

    // Prima della palla a due il file non esiste (il CDN risponde 403): niente richiesta.
    const live = (await this.liveGames([game])).get(game.gameId);
    if (this.statusOf(game, live) === 'scheduled') return EMPTY_BOX;

    const dto = await this.http.get<BoxScoreDto>(`${CDN_URL}/liveData/boxscore/boxscore_${game.gameId}.json`);
    return { home: toBoxScoreSide(dto.game.homeTeam), away: toBoxScoreSide(dto.game.awayTeam) };
  }

  /** La NBA non pubblica l'allenatore tra i dati senza chiave: `coach` è sempre null. */
  async getRoster(teamId: number): Promise<Roster> {
    const nbaTeam = nbaTeamById(teamId);
    if (!nbaTeam) throw new Error(`Squadra ${teamId} non trovata`);
    const team = toTeamRef(nbaTeam);
    const rows = (await this.playerIndex()).filter((row) => row.TEAM_ID === teamId && !row.IS_DEFUNCT);
    return { team, coach: null, players: rows.map((row) => toPlayer(row, team)) };
  }

  private statusOf(game: ScheduleGameDto, update?: ScoreboardGameDto): MatchStatus {
    // Il tabellone è più aggiornato del calendario, ma non deve mai far tornare indietro una partita.
    return STATUSES[Math.max(game.gameStatus, update?.gameStatus ?? 0)] ?? 'scheduled';
  }

  /** Tabellone del giorno per le partite che possono essere in corso: iniziate (o per iniziare a breve) e non ancora concluse. */
  private async liveGames(games: ScheduleGameDto[]): Promise<Map<string, ScoreboardGameDto>> {
    const horizon = Date.now() + 12 * HOUR_MS;
    const open = games.some((g) => g.gameStatus !== 3 && Date.parse(g.gameDateTimeUTC) <= horizon);
    if (!open) return new Map();
    try {
      return await cached(this.scoreboard, SCOREBOARD_TTL_MS, () => this.loadScoreboard(), (entry) => (this.scoreboard = entry));
    } catch {
      // Senza tabellone si resta sui dati del calendario.
      return new Map();
    }
  }

  private async loadScoreboard() {
    const dto = await this.http.get<ScoreboardDto>(`${CDN_URL}/liveData/scoreboard/todaysScoreboard_00.json`);
    return new Map(dto.scoreboard.games.map((g) => [g.gameId, g]));
  }

  /** Partite della Regular Season ("002…") di una stagione, senza i turni a eliminazione della NBA Cup. */
  private async regularSeasonGames(seasonYear: number): Promise<ScheduleGameDto[]> {
    const slot = this.schedule?.year === seasonYear ? this.schedule : null;
    return cached(
      slot,
      SCHEDULE_TTL_MS,
      async () => {
        const dto = await this.http.get<ScheduleDto>(`${CDN_URL}/staticData/scheduleLeagueV2.json`);
        const published = Number(dto.leagueSchedule.seasonYear.slice(0, 4));
        if (published !== seasonYear) throw new Error(`Calendario NBA ${seasonYear}/${seasonYear + 1} non ancora pubblicato`);
        return dto.leagueSchedule.gameDates
          .flatMap((d) => d.games)
          .filter((g) => g.gameId.startsWith('002') && !CUP_KNOCKOUT.has(g.gameSubLabel))
          .filter((g) => nbaTeamById(g.homeTeam.teamId) && nbaTeamById(g.awayTeam.teamId))
          // Copia solo i campi usati: il calendario intero (7 MB) può essere rilasciato.
          .map((g) => ({
            gameId: g.gameId,
            gameCode: g.gameCode,
            gameStatus: g.gameStatus,
            gameDateTimeUTC: g.gameDateTimeUTC,
            gameSubLabel: g.gameSubLabel,
            arenaName: g.arenaName,
            arenaCity: g.arenaCity,
            homeTeam: { teamId: g.homeTeam.teamId, teamTricode: g.homeTeam.teamTricode, score: g.homeTeam.score },
            awayTeam: { teamId: g.awayTeam.teamId, teamTricode: g.awayTeam.teamTricode, score: g.awayTeam.score },
          }));
      },
      (entry) => (this.schedule = entry && { ...entry, year: seasonYear }),
    );
  }

  private playerIndex() {
    return cached(
      this.players,
      PLAYER_INDEX_TTL_MS,
      async () => {
        const dto = await this.http.get<PlayerIndexDto>(`${CDN_URL}/staticData/playerIndex.json`);
        const { headers, rowSet } = dto.resultSets[0];
        return rowSet.map((row) => Object.fromEntries(headers.map((name, i) => [name, row[i]])));
      },
      (entry) => (this.players = entry),
    );
  }
}
