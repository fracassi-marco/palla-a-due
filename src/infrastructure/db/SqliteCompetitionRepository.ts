import { Competition } from '../../domain/entities';
import { CompetitionRepository } from '../../domain/ports';
import { Database } from './Database';

export class SqliteCompetitionRepository implements CompetitionRepository {
  constructor(private readonly db: Database) {}

  async getCurrentRegularSeason(seasonYear: number): Promise<Competition> {
    const row = await this.db.getFirstAsync<{ id: number; name: string; season_year: number }>(
      'SELECT id, name, season_year FROM competitions WHERE season_year = ?',
      [seasonYear],
    );
    if (!row) throw new Error(`Regular Season Serie A ${seasonYear} non ancora scaricata`);
    return { id: row.id, name: row.name, year: row.season_year };
  }
}
