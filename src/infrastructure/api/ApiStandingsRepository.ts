import { Standing } from '../../domain/entities';
import { StandingsRepository } from '../../domain/ports';
import { StandingsResponseDto } from './dto';
import { HttpClient } from './HttpClient';
import { toStanding } from './mappers';

export class ApiStandingsRepository implements StandingsRepository {
  constructor(private readonly http: HttpClient) {}

  async getStandings(competitionId: number): Promise<Standing[]> {
    const response = await this.http.get<StandingsResponseDto>(
      '/championships/get-championship-ranking',
      { id: competitionId },
    );
    return (response.standings ?? []).map(toStanding).sort((a, b) => a.position - b.position);
  }
}
