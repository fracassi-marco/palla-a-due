import { Match } from '../domain/entities';
import { CompetitionRepository, MatchRepository } from '../domain/ports';
import { currentSeasonYear } from './season';

export class GetMatch {
  constructor(
    private readonly competitions: CompetitionRepository,
    private readonly matches: MatchRepository,
  ) {}

  /** Stato e punteggio aggiornati di una partita, riletti dalla sua giornata; null se non trovata. */
  async execute(matchId: number, dayNumber: number, now: Date = new Date()): Promise<Match | null> {
    const competitions = await this.competitions.getSeasonCompetitions(currentSeasonYear(now));
    const rounds = await Promise.all(competitions.map((c) => this.matches.getMatchesByDay(c.id, dayNumber)));
    return rounds.flat().find((m) => m.id === matchId) ?? null;
  }
}
