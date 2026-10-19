import { Roster } from '../entities';

export interface TeamRepository {
  getRoster(teamId: number): Promise<Roster>;
}
