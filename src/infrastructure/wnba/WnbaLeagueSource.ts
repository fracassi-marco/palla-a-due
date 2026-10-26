import { Competition, Match, MatchBoxScore, MatchStatus, Roster } from '../../domain/entities';
import { LeagueSource } from '../../domain/ports';
import { HttpClient } from '../api/HttpClient';
import { BoxScoreDto, PlayerIndexDto, ScheduleDto, ScheduleGameDto, ScoreboardDto, ScoreboardGameDto } from '../nba/dto';
import { gameDate, STATUSES } from '../nba/mappers';
import { competitionId, decodeMatchId, gameCode } from './ids';
import { toBoxScoreSide, toMatch, toPlayer, toTeamRef } from './mappers';
import { wnbaTeamById } from './teams';
import { TtlCache } from './TtlCache';
import { mondayOf, weekOf } from './weeks';

/** Stessa struttura del CDN della NBA, su un altro dominio (con gli stessi controlli sul client: servono `NBA_HEADERS`). */
const CDN_URL = 'https://cdn.wnba.com/static/json';

/** Il calendario dell'anno pesa ~100 KB: una sola copia condivisa da giornate e box score. */
const SCHEDULE_TTL_MS = 2 * 60_000;
/** Durante le partite punteggio e stato vengono dal tabellone del giorno, molto più leggero da rileggere. */
const SCOREBOARD_TTL_MS = 10_000;
/** L'anagrafica dei giocatori cambia solo con le firme e i tagli. */
const PLAYER_INDEX_TTL_MS = 60 * 60_000;
const HOUR_MS = 60 * 60_000;

/** Il campionato è il numero 10 dell'API NBA. */
const SCOREBOARD_FILE = 'todaysScoreboard_10.json';
/** Regular Season ("102…", comprese le partite del girone della Commissioner's Cup): non il precampionato (101), l'All-Star Game (103), i playoff (104) né la finale della Commissioner's Cup (105). */
const REGULAR_SEASON_PREFIX = '102';

/** Partite di Regular Season di un anno e settimane in cui cadono: la prima inizia dal lunedì della prima partita. */
interface Season {
  games: ScheduleGameDto[];
  firstMonday: number;
  totalWeeks: number;
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
const EMPTY_BOX: MatchBoxScore = {
  home: { players: [], totals: EMPTY_STATS },
  away: { players: [], totals: EMPTY_STATS },
};

/**
 * WNBA dal CDN ufficiale (calendario, box score anche in diretta, anagrafica giocatori): gli stessi file della NBA, su
 * `cdn.wnba.com`. Le "giornate" sono le settimane (lunedì-domenica) a partire da quella della prima partita di Regular Season:
 * `weekNumber` del calendario vale sempre 0. Squadre e giocatori hanno gli id ufficiali; le partite l'id di `ids.ts`.
 */
export class WnbaLeagueSource implements LeagueSource {
  private readonly seasons = new TtlCache<Season>(SCHEDULE_TTL_MS);
  private readonly scoreboards = new TtlCache<Map<string, ScoreboardGameDto>>(SCOREBOARD_TTL_MS);
  private readonly players = new TtlCache<Record<string, string | number | null>[]>(PLAYER_INDEX_TTL_MS);

  constructor(private readonly http: HttpClient) {}

  async findRegularSeasons(seasonYear: number): Promise<Competition[]> {
    const { totalWeeks } = await this.season(seasonYear);
    return [{ id: competitionId(seasonYear), name: 'WNBA', year: seasonYear, totalDays: totalWeeks }];
  }

  async getDay(competition: number, dayNumber: number): Promise<Match[]> {
    const seasonYear = 2000 + Math.floor(competition / 10);
    const { games, firstMonday } = await this.season(seasonYear);
    const day = games.filter((g) => weekOf(firstMonday, gameDate(g)) === dayNumber);
    const live = await this.liveGames(day);
    return day.map((game) => {
      const home = wnbaTeamById(game.homeTeam.teamId)!;
      const away = wnbaTeamById(game.awayTeam.teamId)!;
      const update = live.get(game.gameId);
      const status = this.statusOf(game, update);
      const score = update ?? game;
      return toMatch(
        competition,
        firstMonday,
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
    // La stagione WNBA cade nell'anno solare della partita.
    const { games } = await this.season(Number(date.slice(0, 4)));
    const code = gameCode(date, home, away);
    const game = games.find((g) => g.gameCode === code);
    if (!game) throw new Error(`Partita ${code} non trovata nel calendario WNBA`);

    // Prima della palla a due il file non esiste (il CDN risponde 403): niente richiesta.
    const live = (await this.liveGames([game])).get(game.gameId);
    if (this.statusOf(game, live) === 'scheduled') return EMPTY_BOX;

    const dto = await this.http.get<BoxScoreDto>(`${CDN_URL}/liveData/boxscore/boxscore_${game.gameId}.json`);
    return { home: toBoxScoreSide(dto.game.homeTeam), away: toBoxScoreSide(dto.game.awayTeam) };
  }

  /** La WNBA non pubblica l'allenatore né la data di nascita tra i dati senza chiave: `coach` è sempre null. */
  async getRoster(teamId: number): Promise<Roster> {
    const wnbaTeam = wnbaTeamById(teamId);
    if (!wnbaTeam) throw new Error(`Squadra ${teamId} non trovata`);
    const team = toTeamRef(wnbaTeam);
    const rows = (await this.playerIndex()).filter((row) => row.TEAM_ID === teamId);
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
      return await this.scoreboards.get('today', async () => {
        const dto = await this.http.get<ScoreboardDto>(`${CDN_URL}/liveData/scoreboard/${SCOREBOARD_FILE}`);
        return new Map(dto.scoreboard.games.map((g) => [g.gameId, g]));
      });
    } catch {
      // Senza tabellone si resta sui dati del calendario.
      return new Map();
    }
  }

  private season(seasonYear: number): Promise<Season> {
    return this.seasons.get(String(seasonYear), async () => {
      const dto = await this.http.get<ScheduleDto>(`${CDN_URL}/staticData/scheduleLeagueV2.json`);
      // Il file contiene una sola stagione ("2026"); fuori stagione resta quella precedente.
      const published = Number(dto.leagueSchedule.seasonYear.slice(0, 4));
      const games = dto.leagueSchedule.gameDates
        .flatMap((d) => d.games)
        .filter((g) => g.gameId.startsWith(REGULAR_SEASON_PREFIX))
        .filter((g) => wnbaTeamById(g.homeTeam.teamId) && wnbaTeamById(g.awayTeam.teamId))
        // Copia solo i campi usati: il calendario intero può essere rilasciato.
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
      if (published !== seasonYear || games.length === 0) throw new Error(`Calendario WNBA ${seasonYear} non ancora pubblicato`);

      const dates = games.map(gameDate).sort();
      const firstMonday = mondayOf(dates[0]);
      return { games, firstMonday, totalWeeks: weekOf(firstMonday, dates[dates.length - 1]) };
    });
  }

  private playerIndex() {
    return this.players.get('index', async () => {
      const dto = await this.http.get<PlayerIndexDto>(`${CDN_URL}/staticData/playerIndex.json`);
      const { headers, rowSet } = dto.resultSets[0];
      return rowSet.map((row) => Object.fromEntries(headers.map((name, i) => [name, row[i]])));
    });
  }
}
