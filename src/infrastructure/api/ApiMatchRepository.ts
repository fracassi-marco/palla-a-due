import { Match } from '../../domain/entities';
import { MatchRepository } from '../../domain/ports';
import { CalendarResponseDto } from './dto';
import { HttpClient } from './HttpClient';
import { toMatch } from './mappers';

const CALENDAR_PATH = '/championships/get-championships-calendar-by-id';

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
}
