import { MatchBoxScore } from '../../domain/entities';
import { HttpClient } from '../api/HttpClient';
import { LiveBoxScoreDto, LiveHeaderDto } from './dto';
import { seasonCode } from './ids';
import { toLiveBoxScore } from './mappers';
import { EuroleagueSeries } from './series';

/**
 * Feed del sito live (non documentato): le API ufficiali tengono punteggio a 0 e box score vuoto finché la partita
 * non è conclusa, questo invece si aggiorna durante la partita. Se non risponde si resta sui dati dell'API.
 */
const LIVE_URL = 'https://live.euroleague.net/api';

export class LiveFeed {
  constructor(
    private readonly http: HttpClient,
    private readonly series: EuroleagueSeries,
  ) {}

  private params(seasonYear: number, gameCode: number) {
    return { gamecode: gameCode, seasoncode: seasonCode(this.series.code, seasonYear) };
  }

  /** Punteggio dal feed live; null se non disponibile. */
  async score(seasonYear: number, gameCode: number): Promise<{ home: number; away: number } | null> {
    try {
      const header = await this.http.get<LiveHeaderDto>(`${LIVE_URL}/Header`, this.params(seasonYear, gameCode));
      const home = Number(header.ScoreA);
      const away = Number(header.ScoreB);
      return Number.isFinite(home) && Number.isFinite(away) ? { home, away } : null;
    } catch {
      return null;
    }
  }

  async boxScore(seasonYear: number, gameCode: number): Promise<MatchBoxScore | null> {
    try {
      return toLiveBoxScore(await this.http.get<LiveBoxScoreDto>(`${LIVE_URL}/Boxscore`, this.params(seasonYear, gameCode)));
    } catch {
      return null;
    }
  }
}
