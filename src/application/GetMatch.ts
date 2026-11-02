import { Match } from '../domain/entities';
import { MatchRepository } from '../domain/ports';

export class GetMatch {
  constructor(private readonly matches: MatchRepository) {}

  /** Stato e punteggio aggiornati di una partita, di Regular Season o di playoff; null se non salvata. */
  execute(matchId: number): Promise<Match | null> {
    return this.matches.getMatch(matchId);
  }
}
