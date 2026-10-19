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
    const competition = await this.competitions.getCurrentRegularSeason(currentSeasonYear(now));
    const round = await this.matches.getMatchesByDay(competition.id, dayNumber);
    return round.find((m) => m.id === matchId) ?? null;
  }
}
