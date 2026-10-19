import { BoxScore, Match } from '../../domain/entities';
import { MatchRepository } from '../../domain/ports';
import { BoxScoreResponseDto, CalendarResponseDto } from './dto';
import { HttpClient } from './HttpClient';
import { toBoxScore, toMatch } from './mappers';

const BOX_SCORE_PATH = '/championships/get-championships-matches-scores-by-id';
const CALENDAR_PATH = '/championships/get-championships-calendar-by-id';

/** Box score di una partita chiusa: cambia al più per correzioni, quindi una validità lunga ma non infinita. */
const SETTLED_BOX_SCORE_TTL_MS = 24 * 60 * 60 * 1000;

export class ApiMatchRepository implements MatchRepository {
  constructor(private readonly http: HttpClient) {}

  async getCurrentDayMatches(competitionId: number): Promise<Match[]> {
    const response = await this.http.get<CalendarResponseDto>(CALENDAR_PATH, { id: competitionId });
    return (response.matches ?? []).map(toMatch);
  }

  async getMatchesByDay(competitionId: number, dayNumber: number): Promise<Match[]> {
    const response = await this.http.get<CalendarResponseDto>(CALENDAR_PATH, {
      id: competitionId,
      d: dayNumber,
    });
    return (response.matches ?? []).map(toMatch);
  }

  async getBoxScore(matchId: number, settled = false): Promise<BoxScore> {
    const response = await this.http.get<BoxScoreResponseDto>(
      BOX_SCORE_PATH,
      { id: matchId },
      settled ? { ttlMs: SETTLED_BOX_SCORE_TTL_MS } : {},
    );
    return toBoxScore(response);
  }
}
