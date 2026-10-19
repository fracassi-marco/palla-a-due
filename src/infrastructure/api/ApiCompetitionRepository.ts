import { Competition } from '../../domain/entities';
import { CompetitionRepository } from '../../domain/ports';
import { CompetitionsResponseDto } from './dto';
import { HttpClient } from './HttpClient';

export class ApiCompetitionRepository implements CompetitionRepository {
  constructor(private readonly http: HttpClient) {}

  async getCurrentRegularSeason(seasonYear: number): Promise<Competition> {
    const response = await this.http.get<CompetitionsResponseDto>('/championships/get-championships', {
      s: seasonYear,
    });
    const regularSeason = response.competitions.find(
      (c) => c.ctype_code === 'RS' && c.cserie_code === 'A1',
    );
    if (!regularSeason) throw new Error(`Regular Season Serie A ${seasonYear} non trovata`);
    return { id: regularSeason.id, name: regularSeason.name, year: regularSeason.year };
  }
}
