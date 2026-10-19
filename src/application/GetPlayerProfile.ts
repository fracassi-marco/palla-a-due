import { PlayerProfile } from '../domain/entities';
import { PlayerRepository } from '../domain/ports';
import { currentSeasonYear } from './season';

export class GetPlayerProfile {
  constructor(private readonly players: PlayerRepository) {}

  execute(playerId: number): Promise<PlayerProfile> {
    return this.players.getPlayerProfile(playerId, currentSeasonYear());
  }
}
