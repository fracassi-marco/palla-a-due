import { PlayoffBracket } from '../../domain/entities';
import { PlayoffSource } from '../../domain/ports';
import { isOutage } from './FallbackLeagueSource';

/** Come `FallbackLeagueSource` per il tabellone: se la fonte principale è guasta (non se non ha i playoff: `null`) si passa ai backup. */
export class FallbackPlayoffSource implements PlayoffSource {
  constructor(
    private readonly primary: PlayoffSource,
    private readonly backups: PlayoffSource[],
  ) {}

  async getBracket(seasonYear: number): Promise<PlayoffBracket | null> {
    try {
      return await this.primary.getBracket(seasonYear);
    } catch (primaryError) {
      if (!isOutage(primaryError)) throw primaryError;
      for (const backup of this.backups) {
        try {
          return await backup.getBracket(seasonYear);
        } catch {
          // si prova il backup successivo
        }
      }
      throw primaryError;
    }
  }
}
