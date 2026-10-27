import { BoxScore, Match, StatLine } from '../../domain/entities';
import { MatchRepository } from '../../domain/ports';
import { Database } from './Database';
import { GameStatsRow, MATCH_SELECT, MatchRow, toMatch, toStatLine } from './rows';

/** Una partita live o in programma da meno di questo tempo conta ancora come "corrente". */
const RECENT_WINDOW_MS = 6 * 60 * 60 * 1000;

export class SqliteMatchRepository implements MatchRepository {
  constructor(private readonly db: Database) {}

  async getCurrentDayMatches(competitionId: number, now: Date): Promise<Match[]> {
    const upcoming = await this.db.getFirstAsync<{ day_number: number }>(
      // Le partite rinviate di giornate già superate (la più alta con una partita conclusa) non fanno da "corrente".
      `SELECT day_number FROM matches
       WHERE competition_id = ? AND status != 'finished' AND starts_at >= ?
         AND day_number >= COALESCE(
           (SELECT MAX(day_number) FROM matches WHERE competition_id = ? AND status = 'finished'), 0)
       ORDER BY starts_at LIMIT 1`,
      [competitionId, now.getTime() - RECENT_WINDOW_MS, competitionId],
    );
    const day =
      upcoming?.day_number ??
      (
        await this.db.getFirstAsync<{ day_number: number }>(
          'SELECT day_number FROM matches WHERE competition_id = ? ORDER BY starts_at DESC LIMIT 1',
          [competitionId],
        )
      )?.day_number;
    return day === undefined ? [] : this.getMatchesByDay(competitionId, day);
  }

  async getMatchesByDay(competitionId: number, dayNumber: number): Promise<Match[]> {
    const rows = await this.db.getAllAsync<MatchRow>(
      `${MATCH_SELECT} WHERE m.competition_id = ? AND m.day_number = ? ORDER BY m.starts_at, m.id`,
      [competitionId, dayNumber],
    );
    return rows.map(toMatch);
  }

  async getHeadToHead(teamAId: number, teamBId: number, excludeMatchId: number, limit: number): Promise<Match[]> {
    const rows = await this.db.getAllAsync<MatchRow>(
      `${MATCH_SELECT}
       WHERE m.status = 'finished' AND m.id != ? AND m.home_score IS NOT NULL AND m.away_score IS NOT NULL
         AND ((m.home_team_id = ? AND m.away_team_id = ?) OR (m.home_team_id = ? AND m.away_team_id = ?))
       ORDER BY m.starts_at DESC, m.id DESC LIMIT ?`,
      [excludeMatchId, teamAId, teamBId, teamBId, teamAId, limit],
    );
    return rows.map(toMatch);
  }

  async getBoxScore(matchId: number): Promise<BoxScore> {
    const rows = await this.db.getAllAsync<GameStatsRow & { player_id: number; is_home: number }>(
      `SELECT pg.*, CASE WHEN pg.team_id = m.home_team_id THEN 1 ELSE 0 END AS is_home
       FROM player_games pg JOIN matches m ON m.id = pg.match_id
       WHERE pg.match_id = ?`,
      [matchId],
    );
    const home: Record<number, StatLine> = {};
    const away: Record<number, StatLine> = {};
    for (const row of rows) (row.is_home ? home : away)[row.player_id] = toStatLine(row);
    return { home, away };
  }
}
