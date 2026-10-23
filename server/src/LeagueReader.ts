import { BoxScorePlayer, BoxScoreSide, Competition, GameStats, Match, MatchBoxScore, Roster } from '../../src/domain/entities';
import { MatchSyncInfo } from '../../src/domain/ports';
import { Database } from '../../src/infrastructure/db/Database';
import { GameStatsRow, PlayerRow, TeamRow, toPlayer, toTeamRef } from '../../src/infrastructure/db/rows';
import { SqliteLeagueStore } from '../../src/infrastructure/db/SqliteLeagueStore';
import { SqliteMatchRepository } from '../../src/infrastructure/db/SqliteMatchRepository';
import { GAME_STATS_FIELDS } from '../../src/infrastructure/db/schema';

/** Un dato letto dal database con il momento in cui il cron lo ha scaricato. */
export interface Stored<T> {
  value: T;
  fetchedAt: number;
}

const toGameStats = (row: GameStatsRow): GameStats => ({
  minutes: row.minutes,
  points: row.points,
  fouls: row.fouls,
  foulsDrawn: row.fouls_drawn,
  twoMade: row.two_made,
  twoAttempted: row.two_attempted,
  threeMade: row.three_made,
  threeAttempted: row.three_attempted,
  freeThrowsMade: row.free_throws_made,
  freeThrowsAttempted: row.free_throws_attempted,
  offensiveRebounds: row.offensive_rebounds,
  defensiveRebounds: row.defensive_rebounds,
  totalRebounds: row.total_rebounds,
  assists: row.assists,
  steals: row.steals,
  turnovers: row.turnovers,
  blocks: row.blocks,
  blocksAgainst: row.blocks_against,
  rating: row.rating,
});

const STATS = GAME_STATS_FIELDS.map((f) => `pg.${f}`).join(', ');
const TOTALS = GAME_STATS_FIELDS.map((f) => `ts.${f}`).join(', ');

interface BoxScoreRow extends GameStatsRow {
  team_id: number;
  player_id: number;
  first_name: string;
  last_name: string;
  number: string;
  photo_url: string | null;
  starter: number;
  plus_minus: number;
}

/** Lettura dei dati dei cron dal database di un campionato, nella forma del dominio (quella di `LeagueSource`). */
export class LeagueReader {
  private readonly matches: SqliteMatchRepository;
  private readonly store: SqliteLeagueStore;

  constructor(private readonly db: Database) {
    this.matches = new SqliteMatchRepository(db);
    this.store = new SqliteLeagueStore(db);
  }

  /** Repository usato dal backup TheSportsDB per associare le squadre. */
  get matchRepository(): SqliteMatchRepository {
    return this.matches;
  }

  async competitions(seasonYear: number): Promise<Competition[]> {
    return this.store.getCompetitions(seasonYear);
  }

  /** La giornata, se il cron l'ha già scaricata almeno una volta. */
  async day(competitionId: number, dayNumber: number): Promise<Stored<Match[]> | null> {
    const row = await this.db.getFirstAsync<{ fetched_at: number }>(
      'SELECT fetched_at FROM calendar_days WHERE competition_id = ? AND day_number = ?',
      [competitionId, dayNumber],
    );
    if (!row) return null;
    return { value: await this.matches.getMatchesByDay(competitionId, dayNumber), fetchedAt: row.fetched_at };
  }

  matchInfo(matchId: number): Promise<MatchSyncInfo | null> {
    return this.store.getMatchSyncInfo(matchId);
  }

  /** Il box score salvato dal cron; null se non è mai stato scaricato. */
  async boxScore(matchId: number): Promise<Stored<MatchBoxScore> | null> {
    const match = await this.db.getFirstAsync<{ home_team_id: number; box_score_fetched_at: number | null }>(
      'SELECT home_team_id, box_score_fetched_at FROM matches WHERE id = ?',
      [matchId],
    );
    if (!match || match.box_score_fetched_at === null) return null;

    const players = await this.db.getAllAsync<BoxScoreRow>(
      `SELECT pg.team_id, pg.player_id, p.first_name, p.last_name, p.number, p.photo_url, pg.starter, pg.plus_minus, ${STATS}
       FROM player_games pg JOIN players p ON p.id = pg.player_id
       WHERE pg.match_id = ?
       ORDER BY pg.starter DESC, pg.minutes DESC, p.last_name`,
      [matchId],
    );
    const totals = await this.db.getAllAsync<GameStatsRow & { team_id: number }>(
      `SELECT ts.team_id, ${TOTALS} FROM team_game_stats ts WHERE ts.match_id = ?`,
      [matchId],
    );

    const side = (isHome: boolean): BoxScoreSide => {
      const total = totals.find((t) => (t.team_id === match.home_team_id) === isHome);
      return {
        players: players.filter((p) => (p.team_id === match.home_team_id) === isHome).map(toBoxScorePlayer),
        totals: total ? toGameStats(total) : emptyStats(),
      };
    };
    return { value: { home: side(true), away: side(false) }, fetchedAt: match.box_score_fetched_at };
  }

  /** Il roster salvato dal cron; null se non è mai stato scaricato. */
  async roster(teamId: number): Promise<Stored<Roster> | null> {
    const team = await this.db.getFirstAsync<TeamRow & { roster_fetched_at: number | null }>(
      'SELECT id, name, code, logo_url, roster_fetched_at FROM teams WHERE id = ?',
      [teamId],
    );
    if (!team || team.roster_fetched_at === null) return null;

    const coach = await this.db.getFirstAsync<{ id: number; first_name: string; last_name: string; photo_url: string | null }>(
      'SELECT id, first_name, last_name, photo_url FROM coaches WHERE team_id = ? LIMIT 1',
      [teamId],
    );
    // Con has_bio = 1 solo chi è nel roster: gli altri sono creati dai box score e non sono dell'anagrafica.
    const players = await this.db.getAllAsync<PlayerRow>(
      `SELECT p.*, t.name AS team_name FROM players p JOIN teams t ON t.id = p.team_id
       WHERE p.team_id = ? AND p.has_bio = 1 ORDER BY CAST(p.number AS INTEGER), p.last_name`,
      [teamId],
    );
    return {
      value: {
        team: toTeamRef(team),
        coach: coach ? { id: coach.id, firstName: coach.first_name, lastName: coach.last_name, photoUrl: coach.photo_url } : null,
        players: players.map(toPlayer),
      },
      fetchedAt: team.roster_fetched_at,
    };
  }
}

const toBoxScorePlayer = (row: BoxScoreRow): BoxScorePlayer => ({
  id: row.player_id,
  firstName: row.first_name,
  lastName: row.last_name,
  number: row.number,
  photoUrl: row.photo_url,
  starter: row.starter === 1,
  plusMinus: row.plus_minus,
  stats: toGameStats(row),
});

const emptyStats = (): GameStats => ({
  minutes: 0, points: 0, fouls: 0, foulsDrawn: 0, twoMade: 0, twoAttempted: 0, threeMade: 0, threeAttempted: 0,
  freeThrowsMade: 0, freeThrowsAttempted: 0, offensiveRebounds: 0, defensiveRebounds: 0, totalRebounds: 0,
  assists: 0, steals: 0, turnovers: 0, blocks: 0, blocksAgainst: 0, rating: 0,
});
