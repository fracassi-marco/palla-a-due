import { BoxScore } from '../domain/entities';
import { MatchRepository } from '../domain/ports';

export class GetMatchBoxScore {
  constructor(private readonly matches: MatchRepository) {}

  execute(matchId: number): Promise<BoxScore> {
    return this.matches.getBoxScore(matchId);
  }
}
