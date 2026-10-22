import { Competition, Match, MatchBoxScore, Roster } from '../../domain/entities';
import { LeagueSource } from '../../domain/ports';
import { HttpError } from '../api/HttpClient';

/** Dopo un'interruzione della fonte principale si va direttamente ai backup per questo tempo, senza ritentarla a ogni richiesta. */
const PRIMARY_COOLDOWN_MS = 60_000;

/** Un guasto della fonte (rete, server, limite di richieste, dati in un formato nuovo) e non una richiesta sbagliata (404 e simili). */
function isOutage(error: unknown): boolean {
  if (!(error instanceof HttpError)) return true;
  return error.status >= 500 || error.status === 429 || error.status === 408;
}

/**
 * Interroga la fonte principale e, se si guasta, i backup in ordine. Se falliscono tutti, l'errore è quello della principale
 * (i backup possono coprire solo una parte dei dati e rifiutare il resto).
 */
export class FallbackLeagueSource implements LeagueSource {
  private primaryDownUntil = 0;
  /** Ultimo guasto della principale: è l'errore restituito se non risponde nemmeno un backup. */
  private primaryError: unknown = null;

  constructor(
    private readonly primary: LeagueSource,
    private readonly backups: LeagueSource[],
  ) {}

  findRegularSeasons(seasonYear: number): Promise<Competition[]> {
    return this.run((source) => source.findRegularSeasons(seasonYear));
  }

  getDay(competitionId: number, dayNumber: number): Promise<Match[]> {
    return this.run((source) => source.getDay(competitionId, dayNumber));
  }

  getBoxScore(matchId: number): Promise<MatchBoxScore> {
    return this.run((source) => source.getBoxScore(matchId));
  }

  getRoster(teamId: number): Promise<Roster> {
    return this.run((source) => source.getRoster(teamId));
  }

  private async run<T>(call: (source: LeagueSource) => Promise<T>): Promise<T> {
    if (Date.now() >= this.primaryDownUntil) {
      try {
        return await call(this.primary);
      } catch (error) {
        // Una richiesta sbagliata (404 e simili) non è un guasto: i backup non la risolverebbero.
        if (!isOutage(error)) throw error;
        this.primaryDownUntil = Date.now() + PRIMARY_COOLDOWN_MS;
        this.primaryError = error;
      }
    }
    for (const backup of this.backups) {
      try {
        return await call(backup);
      } catch {
        // si prova il backup successivo
      }
    }
    throw this.primaryError;
  }
}
