import { Coach, Roster, TeamResult } from '../../domain/entities';
import { TeamRepository, TeamSeasonStats } from '../../domain/ports';
import { Database } from './Database';
import { PlayerRow, TeamRow, toPlayer, toTeamRef } from './rows';

interface SeasonTotalsRow {
  team_id: number;
  games: number;
  points: number;
  offensive_rebounds: number;
  defensive_rebounds: number;
  total_rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
  rating: number;
  two_made: number;
  two_attempted: number;
  three_made: number;
  three_attempted: number;
  free_throws_made: number;
  free_throws_attempted: number;
}

const percent = (made: number, attempted: number) => (attempted > 0 ? (made / attempted) * 100 : null);

/** 1 + il numero di squadre con un valore strettamente migliore. */
const rankOf = (rows: SeasonTotalsRow[], own: SeasonTotalsRow, avg: (r: SeasonTotalsRow) => number) =>
  rows.filter((r) => avg(r) > avg(own)).length + 1;

export class SqliteTeamRepository implements TeamRepository {
  constructor(private readonly db: Database) {}

  async getRoster(teamId: number): Promise<Roster> {
    const team = await this.db.getFirstAsync<TeamRow>('SELECT id, name, code, logo_url FROM teams WHERE id = ?', [teamId]);
    if (!team) throw new Error(`Squadra ${teamId} non trovata`);

    const coach = await this.db.getFirstAsync<{ id: number; first_name: string; last_name: string; photo_url: string | null }>(
      'SELECT id, first_name, last_name, photo_url FROM coaches WHERE team_id = ? LIMIT 1',
      [teamId],
    );
    const players = await this.db.getAllAsync<PlayerRow>(
      `SELECT p.*, t.name AS team_name FROM players p JOIN teams t ON t.id = p.team_id
       WHERE p.team_id = ? ORDER BY CAST(p.number AS INTEGER), p.last_name`,
      [teamId],
    );
    return {
      team: toTeamRef(team),
      coach: coach
        ? ({ id: coach.id, firstName: coach.first_name, lastName: coach.last_name, photoUrl: coach.photo_url } satisfies Coach)
        : null,
      players: players.map(toPlayer),
    };
  }

  async getSeasonStats(teamId: number, seasonYear: number): Promise<TeamSeasonStats | null> {
    const rows = await this.db.getAllAsync<SeasonTotalsRow>(
      `SELECT s.* FROM team_season_totals s JOIN competitions c ON c.id = s.competition_id WHERE c.season_year = ?`,
      [seasonYear],
    );
    const own = rows.find((r) => r.team_id === teamId);
    if (!own) return null;

    const avg = (field: (r: SeasonTotalsRow) => number) => (r: SeasonTotalsRow) => field(r) / r.games;
    const points = avg((r) => r.points);
    const rebounds = avg((r) => r.total_rebounds);
    const assists = avg((r) => r.assists);
    return {
      pointsRank: rankOf(rows, own, points),
      reboundsRank: rankOf(rows, own, rebounds),
      assistsRank: rankOf(rows, own, assists),
      avgPoints: points(own),
      avgOffensiveRebounds: own.offensive_rebounds / own.games,
      avgDefensiveRebounds: own.defensive_rebounds / own.games,
      avgAssists: assists(own),
      avgSteals: own.steals / own.games,
      avgBlocks: own.blocks / own.games,
      avgTurnovers: own.turnovers / own.games,
      avgFouls: own.fouls / own.games,
      avgRating: own.rating / own.games,
      twoPercent: percent(own.two_made, own.two_attempted),
      threePercent: percent(own.three_made, own.three_attempted),
      freeThrowPercent: percent(own.free_throws_made, own.free_throws_attempted),
    };
  }

  async getResults(teamId: number, seasonYear: number): Promise<TeamResult[]> {
    const rows = await this.db.getAllAsync<{
      match_id: number;
      starts_at: number;
      is_home: number;
      team_score: number;
      opponent_score: number;
      won: number;
      opponent_name: string;
    }>(
      `SELECT g.match_id, g.starts_at, g.is_home, g.team_score, g.opponent_score, g.won, o.name AS opponent_name
       FROM team_games g
       JOIN competitions c ON c.id = g.competition_id
       JOIN teams o ON o.id = g.opponent_id
       WHERE g.team_id = ? AND c.season_year = ?
       ORDER BY g.starts_at, g.match_id`,
      [teamId, seasonYear],
    );
    return rows.map((r) => ({
      matchId: r.match_id,
      date: new Date(r.starts_at),
      opponentName: r.opponent_name,
      isHome: r.is_home === 1,
      teamScore: r.team_score,
      opponentScore: r.opponent_score,
      won: r.won === 1,
    }));
  }
}
