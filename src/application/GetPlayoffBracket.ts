import { PlayoffBracket } from '../domain/entities';
import { PlayoffSource } from '../domain/ports';
import { currentSeasonYear } from './season';

export class GetPlayoffBracket {
  constructor(private readonly source: PlayoffSource) {}

  /** Tabellone della stagione corrente; `null` prima dei playoff. */
  execute(): Promise<PlayoffBracket | null> {
    return this.source.getBracket(currentSeasonYear());
  }
}
