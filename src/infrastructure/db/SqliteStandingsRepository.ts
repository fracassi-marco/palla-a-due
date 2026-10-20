import { Standing } from '../../domain/entities';
import { StandingsRepository } from '../../domain/ports';
import { computeStandings, StandingsZones, TeamGame } from '../../domain/standings';
import { Database } from './Database';
import { COMPETITION_TEAM_IDS, TeamRow, toTeamRef } from './rows';

export class SqliteStandingsRepository implements StandingsRepository {
  constructor(
    private readonly db: Database,
    private readonly zones: StandingsZones,
  ) {}

  async getStandings(competitionId: number): Promise<Standing[]> {
    const [teams, games] = await Promise.all([
      this.db.getAllAsync<TeamRow>(`SELECT id, name, code, logo_url FROM teams WHERE id IN (${COMPETITION_TEAM_IDS})`, [
        competitionId,
        competitionId,
      ]),
      this.db.getAllAsync<{ team_id: number; opponent_id: number; team_score: number; opponent_score: number }>(
        'SELECT team_id, opponent_id, team_score, opponent_score FROM team_games WHERE competition_id = ?',
        [competitionId],
      ),
    ]);
    const teamGames: TeamGame[] = games.map((g) => ({
      teamId: g.team_id,
      opponentId: g.opponent_id,
      teamScore: g.team_score,
      opponentScore: g.opponent_score,
    }));
    return computeStandings(teams.map(toTeamRef), teamGames, this.zones);
  }
}
