import { BoxScore } from '../domain/entities';
import { MatchRepository } from '../domain/ports';

export class GetMatchBoxScore {
  constructor(private readonly matches: MatchRepository) {}

  /** Dal database: vuoto finché il box score non è stato scaricato (vedi SyncLeague.refreshMatch). */
  execute(matchId: number): Promise<BoxScore> {
    return this.matches.getBoxScore(matchId);
  }
}
