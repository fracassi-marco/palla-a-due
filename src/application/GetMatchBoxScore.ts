import { BoxScore, Match } from '../domain/entities';
import { MatchRepository } from '../domain/ports';

const HOURS = 60 * 60 * 1000;
/** Margine dopo la palla a due oltre il quale una partita segnata come finita non riceve più correzioni live. */
const SETTLE_MARGIN_MS = 3 * HOURS;

export class GetMatchBoxScore {
  constructor(private readonly matches: MatchRepository) {}

  /** `match` serve a capire se la partita è chiusa: in quel caso il box score può restare a lungo in cache. */
  execute(matchId: number, match?: Pick<Match, 'status' | 'startsAt'>, now: Date = new Date()): Promise<BoxScore> {
    const settled =
      match?.status === 'finished' && now.getTime() > match.startsAt.getTime() + SETTLE_MARGIN_MS;
    return this.matches.getBoxScore(matchId, settled);
  }
}
