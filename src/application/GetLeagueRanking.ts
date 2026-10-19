import { LeagueRankingEntry, RankedStat } from '../domain/entities';
import { PlayerRepository } from '../domain/ports';
import { currentSeasonYear } from './season';

export class GetLeagueRanking {
  constructor(private readonly players: PlayerRepository) {}

  execute(stat: RankedStat): Promise<LeagueRankingEntry[]> {
    return this.players.getLeagueRanking(stat, currentSeasonYear());
  }
}
