import { Roster } from '../../domain/entities';
import { TeamRepository } from '../../domain/ports';
import { RosterResponseDto } from './dto';
import { HttpClient } from './HttpClient';
import { toRoster } from './mappers';

export class ApiTeamRepository implements TeamRepository {
  constructor(private readonly http: HttpClient) {}

  async getRoster(teamId: number): Promise<Roster> {
    const response = await this.http.get<RosterResponseDto>('/teams/get-team-roster', { id: teamId });
    return toRoster(response);
  }
}
