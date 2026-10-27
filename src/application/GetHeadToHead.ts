import { Match } from '../domain/entities';
import { MatchRepository } from '../domain/ports';

export interface HeadToHead {
  /** Gli scontri più recenti, dal più recente. */
  matches: Match[];
  /** Vittorie di ciascuna squadra negli scontri elencati. */
  homeWins: number;
  awayWins: number;
}

/** Quanti scontri diretti mostrare. */
const HEAD_TO_HEAD_LIMIT = 5;

export class GetHeadToHead {
  constructor(private readonly matches: MatchRepository) {}

  /** Ultimi scontri conclusi tra due squadre, tra tutte le partite nel database (anche di altre fasi o stagioni). */
  async execute(homeId: number, awayId: number, excludeMatchId: number): Promise<HeadToHead> {
    const matches = await this.matches.getHeadToHead(homeId, awayId, excludeMatchId, HEAD_TO_HEAD_LIMIT);
    let homeWins = 0;
    let awayWins = 0;
    for (const m of matches) {
      const homeSide = (m.homeScore ?? 0) - (m.awayScore ?? 0);
      if (homeSide === 0) continue;
      const winnerId = homeSide > 0 ? m.home.id : m.away.id;
      if (winnerId === homeId) homeWins++;
      else awayWins++;
    }
    return { matches, homeWins, awayWins };
  }
}
