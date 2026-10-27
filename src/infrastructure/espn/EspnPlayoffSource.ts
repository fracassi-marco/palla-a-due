import { PlayoffBracket, TeamRef } from '../../domain/entities';
import { PlayoffSource } from '../../domain/ports';
import { HttpClient } from '../api/HttpClient';
import { buildBracket, PlayoffGame, PlayoffGameTeam, PlayoffRoundConfig } from '../playoffs/bracket';
import { EspnPlayoffEventDto, EspnPlayoffScoreboardDto } from './dto';

export interface EspnPlayoffConfig {
  scoreboardUrl: string;
  /** Anno con cui ESPN indica la stagione (`dates=`) dato l'anno di inizio della stagione. */
  espnYear: (seasonYear: number) => number;
  /** Dal primo turno alla finale; `match` riconosce il turno dal titolo della partita ("West Finals - Game 2"). */
  rounds: (PlayoffRoundConfig & { match: RegExp })[];
  /** Squadra dalla sigla ESPN; `undefined` per una sigla non nota (squadra da definire o nuova). */
  teamByEspnCode: (code: string) => TeamRef | undefined;
}

/**
 * Tabellone dei playoff dal tabellone di ESPN (senza chiave né protezioni): il backup delle fonti ufficiali, e la fonte dove
 * quella ufficiale non è stata provata. Non ha le teste di serie. Non ha cache: la fanno i chiamanti (il backend).
 */
export class EspnPlayoffSource implements PlayoffSource {
  constructor(
    private readonly http: HttpClient,
    private readonly config: EspnPlayoffConfig,
  ) {}

  async getBracket(seasonYear: number): Promise<PlayoffBracket | null> {
    const dto = await this.http.get<EspnPlayoffScoreboardDto>(this.config.scoreboardUrl, {
      dates: String(this.config.espnYear(seasonYear)),
      limit: '1000',
    });
    const games = dto.events.filter((e) => e.season.type === 3).flatMap((e) => this.toGame(e));
    return games.length === 0 ? null : buildBracket(games, this.config.rounds);
  }

  /** `[]` per una partita fuori dai turni noti o con una squadra non nota. */
  private toGame(event: EspnPlayoffEventDto): PlayoffGame[] {
    const game = event.competitions[0];
    const round = this.config.rounds.findIndex((r) => r.match.test(game.notes?.[0]?.headline ?? ''));
    const home = game.competitors.find((c) => c.homeAway === 'home');
    const away = game.competitors.find((c) => c.homeAway === 'away');
    if (round < 0 || !home || !away) return [];

    const side = (competitor: typeof home): PlayoffGameTeam | null => {
      const team = this.config.teamByEspnCode(competitor.team.abbreviation);
      const seriesWins = game.series?.competitors.find((c) => c.id === competitor.team.id)?.wins ?? 0;
      return team ? { team, seed: null, seriesWins } : null;
    };
    const [homeSide, awaySide] = [side(home), side(away)];
    if (!homeSide || !awaySide) return [];
    return [{ round, startsAt: new Date(event.date), state: game.status.type.state, home: homeSide, away: awaySide }];
  }
}
