import { Roster, TeamResult } from '../../domain/entities';
import { TeamRepository, TeamSeasonStats } from '../../domain/ports';
import { RosterResponseDto, TeamMatchesStatsResponseDto, TeamStatsResponseDto } from './dto';
import { HttpClient } from './HttpClient';
import { toRoster, toTeamResult, toTeamSeasonStats } from './mappers';

export class ApiTeamRepository implements TeamRepository {
  constructor(private readonly http: HttpClient) {}

  async getRoster(teamId: number): Promise<Roster> {
    const response = await this.http.get<RosterResponseDto>('/teams/get-team-roster', { id: teamId });
    return toRoster(response);
  }

  async getSeasonStats(teamId: number, seasonYear: number): Promise<TeamSeasonStats | null> {
    const response = await this.http.get<TeamStatsResponseDto>('/teams/get-team-stats', { id: teamId, s: seasonYear });
    return toTeamSeasonStats(response);
  }

  async getResults(teamId: number, seasonYear: number): Promise<TeamResult[]> {
    const response = await this.http.get<TeamMatchesStatsResponseDto>('/teams/get-team-matches-stats', {
      id: teamId,
      s: seasonYear,
    });
    return (response.matches ?? [])
      .map(toTeamResult)
      .filter((r): r is TeamResult => r !== null)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }
}
