import { PlayerProfile } from '../entities';

export interface PlayerRepository {
  getPlayerProfile(playerId: number, seasonYear: number): Promise<PlayerProfile>;
}
