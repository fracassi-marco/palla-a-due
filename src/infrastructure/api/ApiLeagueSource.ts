import { Competition, Match, MatchBoxScore, Roster } from '../../domain/entities';
import { LeagueSource } from '../../domain/ports';
import { BoxScoreResponseDto, CalendarResponseDto, CompetitionsResponseDto, RosterResponseDto } from './dto';
import { HttpClient } from './HttpClient';
import { toMatch, toMatchBoxScore, toRoster } from './mappers';

export class ApiLeagueSource implements LeagueSource {
  constructor(private readonly http: HttpClient) {}

  async findRegularSeasons(seasonYear: number): Promise<Competition[]> {
    const response = await this.http.get<CompetitionsResponseDto>('/championships/get-championships', {
      s: seasonYear,
    });
    const regularSeason = response.competitions.find((c) => c.ctype_code === 'RS' && c.cserie_code === 'A1');
    if (!regularSeason) throw new Error(`Regular Season Serie A ${seasonYear} non trovata`);
    return [{ id: regularSeason.id, name: regularSeason.name, year: regularSeason.year }];
  }

  async getDay(competitionId: number, dayNumber: number): Promise<Match[]> {
    const response = await this.http.get<CalendarResponseDto>('/championships/get-championships-calendar-by-id', {
      id: competitionId,
      d: dayNumber,
    });
    return (response.matches ?? []).map(toMatch);
  }

  async getBoxScore(matchId: number): Promise<MatchBoxScore> {
    const response = await this.http.get<BoxScoreResponseDto>('/championships/get-championships-matches-scores-by-id', {
      id: matchId,
    });
    return toMatchBoxScore(response);
  }

  async getRoster(teamId: number): Promise<Roster> {
    const response = await this.http.get<RosterResponseDto>('/teams/get-team-roster', { id: teamId });
    return toRoster(response);
  }
}
