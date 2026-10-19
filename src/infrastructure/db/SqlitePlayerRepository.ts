import { GameLogEntry, LeagueRanks, LeagueRankingEntry, PlayerProfile, RankedStat, StatLine } from '../../domain/entities';
import { PlayerRepository } from '../../domain/ports';
import { averageLines, maxLines, rankInLeague, sortByStat, sumLines } from '../../domain/statLines';
import { Database } from './Database';
import { GameStatsRow, PlayerRow, toPlayer, toStatLine } from './rows';

interface GameRow extends GameStatsRow {
  match_id: number;
  starts_at: number;
  is_home: number;
  team_score: number;
  opponent_score: number;
  opponent_name: string;
  opponent_logo: string | null;
}

/** Chi è uscito dal roster non ha più una squadra: si ripiega su quella dell'ultima partita giocata. */
const PLAYER_SELECT = `SELECT p.id, p.first_name, p.last_name, p.number, p.role, p.country, p.birth_date, p.birth_place,
       p.height_cm, p.weight_kg, p.photo_url, t.id AS team_id, t.name AS team_name
FROM players p
LEFT JOIN teams t ON t.id = COALESCE(
  p.team_id,
  (SELECT pg.team_id FROM player_games pg JOIN matches m ON m.id = pg.match_id
   WHERE pg.player_id = p.id ORDER BY m.starts_at DESC LIMIT 1))`;

export class SqlitePlayerRepository implements PlayerRepository {
  constructor(private readonly db: Database) {}

  async getPlayerProfile(playerId: number, seasonYear: number): Promise<PlayerProfile> {
    const player = await this.db.getFirstAsync<PlayerRow>(`${PLAYER_SELECT} WHERE p.id = ?`, [playerId]);
    if (!player) throw new Error(`Giocatore ${playerId} non trovato`);

    // Solo le partite in cui è sceso in campo, dalla più recente.
    const games = await this.db.getAllAsync<GameRow>(
      `SELECT pg.*, m.starts_at,
              CASE WHEN pg.team_id = m.home_team_id THEN 1 ELSE 0 END AS is_home,
              CASE WHEN pg.team_id = m.home_team_id THEN m.home_score ELSE m.away_score END AS team_score,
              CASE WHEN pg.team_id = m.home_team_id THEN m.away_score ELSE m.home_score END AS opponent_score,
              o.name AS opponent_name, o.logo_url AS opponent_logo
       FROM player_games pg
       JOIN matches m ON m.id = pg.match_id AND m.status = 'finished'
       JOIN competitions c ON c.id = m.competition_id AND c.season_year = ?
       JOIN teams o ON o.id = CASE WHEN pg.team_id = m.home_team_id THEN m.away_team_id ELSE m.home_team_id END
       WHERE pg.player_id = ? AND pg.minutes > 0
       ORDER BY m.starts_at DESC, m.id DESC`,
      [seasonYear, playerId],
    );

    const gameLog: GameLogEntry[] = games.map((g) => ({
      matchId: g.match_id,
      date: new Date(g.starts_at),
      opponentName: g.opponent_name,
      opponentLogoUrl: g.opponent_logo,
      isHome: g.is_home === 1,
      teamScore: g.team_score,
      opponentScore: g.opponent_score,
      won: g.team_score > g.opponent_score,
      line: toStatLine(g),
    }));
    const lines = gameLog.map((g) => g.line);

    const totals = sumLines(lines);
    return {
      player: toPlayer(player),
      seasonYear,
      averages: averageLines(lines),
      highs: maxLines(lines),
      totals,
      ranks: totals ? await this.getLeagueRanks(totals, seasonYear) : {},
      gameLog,
    };
  }

  /** Posizione rispetto a tutti i giocatori della stagione, dai totali di `player_season_totals`. */
  private async getLeagueRanks(own: StatLine, seasonYear: number): Promise<LeagueRanks> {
    const rows = await this.db.getAllAsync<GameStatsRow & { games: number }>(
      `SELECT s.* FROM player_season_totals s JOIN competitions c ON c.id = s.competition_id WHERE c.season_year = ?`,
      [seasonYear],
    );
    return rankInLeague(
      own,
      rows.map((r) => toStatLine(r, r.games)),
    );
  }

  async getLeagueRanking(stat: RankedStat, seasonYear: number): Promise<LeagueRankingEntry[]> {
    const rows = await this.db.getAllAsync<PlayerRow & GameStatsRow & { games: number }>(
      `SELECT s.*, pl.* FROM player_season_totals s
       JOIN competitions c ON c.id = s.competition_id AND c.season_year = ?
       JOIN (${PLAYER_SELECT}) pl ON pl.id = s.player_id`,
      [seasonYear],
    );
    const items = rows.map((r) => ({ totals: toStatLine(r, r.games), player: toPlayer(r) }));
    return sortByStat(stat, items).map(({ position, value, item }) => ({
      position,
      value,
      matches: item.totals.matches,
      player: item.player,
    }));
  }
}
