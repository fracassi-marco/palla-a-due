import { Roster } from '../domain/entities';
import { TeamRepository } from '../domain/ports';

export class GetTeamRoster {
  constructor(private readonly teams: TeamRepository) {}

  execute(teamId: number): Promise<Roster> {
    return this.teams.getRoster(teamId);
  }
}
