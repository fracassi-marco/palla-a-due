import { PlayoffBracket, TeamRef } from '../../domain/entities';
import { PlayoffSource } from '../../domain/ports';
import { HttpClient } from '../api/HttpClient';
import { buildBracket, PlayoffGame, PlayoffGameTeam, PlayoffRoundConfig } from '../playoffs/bracket';

/** I playoff nel calendario del CDN ufficiale (solo i campi letti): stessa forma per NBA e WNBA. */
interface PlayoffGameDto {
  gameId: string;
  /** 1 = da giocare, 2 = in corso, 3 = conclusa. */
  gameStatus: number;
  gameDateTimeUTC: string;
  /** Turno: "First Round", "Semifinals", "WNBA Finals". */
  gameLabel: string;
  /** `wins` sono le vittorie della serie, `seed` la testa di serie. */
  homeTeam: { teamId: number; wins: number; seed: number };
  awayTeam: { teamId: number; wins: number; seed: number };
}

interface ScheduleDto {
  leagueSchedule: { seasonYear: string; gameDates: { games: PlayoffGameDto[] }[] };
}

export interface OfficialPlayoffConfig {
  scheduleUrl: string;
  /** Prefisso del `gameId` delle partite di playoff ("104" per la WNBA). */
  gameIdPrefix: string;
  /** Dal primo turno alla finale; `match` riconosce il turno da `gameLabel`. */
  rounds: (PlayoffRoundConfig & { match: RegExp })[];
  /** Squadra dall'id ufficiale; `undefined` per una squadra ancora da definire. */
  teamById: (id: number) => TeamRef | undefined;
}

const STATES = { 1: 'pre', 2: 'in', 3: 'post' } as const;

/**
 * Tabellone dei playoff dal calendario ufficiale (lo stesso file della Regular Season): turno, vittorie di serie e teste di serie
 * le dà la fonte. Il file contiene una sola stagione: per un'altra, o prima dei playoff, il tabellone è `null`.
 */
export class OfficialPlayoffSource implements PlayoffSource {
  constructor(
    private readonly http: HttpClient,
    private readonly config: OfficialPlayoffConfig,
  ) {}

  async getBracket(seasonYear: number): Promise<PlayoffBracket | null> {
    const { leagueSchedule } = await this.http.get<ScheduleDto>(this.config.scheduleUrl);
    // "2026" (WNBA) o "2026-27" (NBA): in entrambi i casi comincia con l'anno di inizio.
    if (!leagueSchedule.seasonYear.startsWith(String(seasonYear))) return null;

    const games = leagueSchedule.gameDates
      .flatMap((d) => d.games)
      .filter((g) => g.gameId.startsWith(this.config.gameIdPrefix))
      .flatMap((g) => this.toGame(g));
    return games.length === 0 ? null : buildBracket(games, this.config.rounds);
  }

  /** `[]` per una partita fuori dai turni noti o con una squadra ancora da definire. */
  private toGame(game: PlayoffGameDto): PlayoffGame[] {
    const round = this.config.rounds.findIndex((r) => r.match.test(game.gameLabel));
    const side = (team: PlayoffGameDto['homeTeam']): PlayoffGameTeam | null => {
      const ref = this.config.teamById(team.teamId);
      return ref ? { team: ref, seed: team.seed || null, seriesWins: team.wins } : null;
    };
    const [home, away] = [side(game.homeTeam), side(game.awayTeam)];
    if (round < 0 || !home || !away) return [];
    return [{ round, startsAt: new Date(game.gameDateTimeUTC), state: STATES[game.gameStatus as 1 | 2 | 3] ?? 'pre', home, away }];
  }
}
