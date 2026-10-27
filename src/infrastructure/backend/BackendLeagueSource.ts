import { Competition, Match, MatchBoxScore, PlayoffBracket, PlayoffRound, PlayoffSeries, Roster } from '../../domain/entities';
import { LeagueId } from '../../domain/League';
import { LeagueSource, PlayoffSource } from '../../domain/ports';
import { HttpClient } from '../api/HttpClient';

/** Ogni risposta dell'API del backend (`server/src/api.ts`) avvolge il dato con la sua provenienza. */
interface Envelope<T> {
  /** `db` = salvato dai cron; `live` = appena scaricato dalla sorgente. */
  source: 'db' | 'live';
  updatedAt: number;
  data: T;
}

/** Una partita com'è in JSON: la data arriva come testo ISO. */
type MatchJson = Omit<Match, 'startsAt'> & { startsAt: string };

/** Il tabellone playoff in JSON: la data della prossima partita arriva come testo ISO. */
type PlayoffBracketJson = { rounds: (Omit<PlayoffRound, 'series'> & { series: ((Omit<PlayoffSeries, 'nextGameAt'> & { nextGameAt: string | null }) | null)[] })[] };

const toMatch = (json: MatchJson): Match => ({ ...json, startsAt: new Date(json.startsAt) });

/** Dati del campionato dal nostro backend: la stessa forma della sorgente diretta, già normalizzata. */
export class BackendLeagueSource implements LeagueSource, PlayoffSource {
  constructor(
    private readonly http: HttpClient,
    private readonly league: LeagueId,
  ) {}

  private async read<T>(path: string, params?: Record<string, string | number>): Promise<T> {
    return (await this.http.get<Envelope<T>>(`/v1/${this.league}${path}`, params)).data;
  }

  findRegularSeasons(seasonYear: number): Promise<Competition[]> {
    return this.read('/competitions', { season: seasonYear });
  }

  async getDay(competitionId: number, dayNumber: number): Promise<Match[]> {
    const matches = await this.read<MatchJson[]>(`/competitions/${competitionId}/days/${dayNumber}`);
    return matches.map(toMatch);
  }

  getBoxScore(matchId: number): Promise<MatchBoxScore> {
    return this.read(`/matches/${matchId}/box-score`);
  }

  async getBracket(seasonYear: number): Promise<PlayoffBracket | null> {
    const bracket = await this.read<PlayoffBracketJson | null>('/playoffs', { season: seasonYear });
    if (!bracket) return null;
    return {
      rounds: bracket.rounds.map((round) => ({
        ...round,
        series: round.series.map((s) => s && { ...s, nextGameAt: s.nextGameAt ? new Date(s.nextGameAt) : null }),
      })),
    };
  }

  getRoster(teamId: number): Promise<Roster> {
    return this.read(`/teams/${teamId}/roster`);
  }
}
