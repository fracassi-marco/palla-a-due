import { Competition } from '../../domain/entities';
import { CompetitionRepository } from '../../domain/ports';
import { Database } from './Database';

export class SqliteCompetitionRepository implements CompetitionRepository {
  constructor(private readonly db: Database) {}

  async getSeasonCompetitions(seasonYear: number): Promise<Competition[]> {
    const rows = await this.db.getAllAsync<{ id: number; name: string; season_year: number }>(
      'SELECT id, name, season_year FROM competitions WHERE season_year = ? ORDER BY id',
      [seasonYear],
    );
    if (rows.length === 0) throw new Error(`Regular Season ${seasonYear} non ancora scaricata`);
    return rows.map((row) => ({ id: row.id, name: row.name, year: row.season_year }));
  }
}
