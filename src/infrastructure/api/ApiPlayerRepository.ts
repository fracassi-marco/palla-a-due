import { PlayerProfile } from '../../domain/entities';
import { PlayerRepository } from '../../domain/ports';
import { GameLogResponseDto, PlayerStatsResponseDto } from './dto';
import { HttpClient } from './HttpClient';
import { toPlayerProfile } from './mappers';

export class ApiPlayerRepository implements PlayerRepository {
  constructor(private readonly http: HttpClient) {}

  async getPlayerProfile(playerId: number, seasonYear: number): Promise<PlayerProfile> {
    const params = { id: playerId, s: seasonYear };
    const [stats, gameLog] = await Promise.all([
      this.http.get<PlayerStatsResponseDto>('/players/get-player-stats', params),
      this.http.get<GameLogResponseDto>('/players/get-player-matches', params),
    ]);
    return toPlayerProfile(
      stats.player,
      stats.stats?.data ?? null,
      gameLog.matches_stats?.data ?? [],
      seasonYear,
    );
  }
}
