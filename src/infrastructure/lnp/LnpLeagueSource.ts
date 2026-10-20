import { Competition, Match, MatchBoxScore, Roster } from '../../domain/entities';
import { LeagueSource } from '../../domain/ports';
import { HttpClient, HttpError } from '../api/HttpClient';
import { ScheduleGameDto } from './dto';
import { competitionId, decodeCompetitionId, decodeMatchId, seasonKey } from './ids';
import { SITE_URL, toMatch, toTeamRef } from './mappers';
import { parseBoxScore, parseTeamListing, parseTeamPage, TeamListing, toCoach } from './parsers';
import { LnpSeries } from './series';

const STATS_URL = 'https://lnpstat.domino.it/getstatisticsfiles';

/**
 * Lega Nazionale Pallacanestro (Serie A2 e B Nazionale). Calendario e risultati sono JSON (`lnpstat.domino.it`);
 * box score e roster esistono solo come pagine HTML di legapallacanestro.com, che vengono lette.
 */
export class LnpLeagueSource implements LeagueSource {
  /** Elenco delle squadre (schede e logo): si scarica una volta, alla prima richiesta. */
  private teams: Promise<Map<number, TeamListing>> | null = null;

  constructor(
    private readonly http: HttpClient,
    private readonly series: LnpSeries,
  ) {}

  async findRegularSeasons(seasonYear: number): Promise<Competition[]> {
    return this.series.groups.map((group) => ({
      id: competitionId(seasonYear, group),
      name: group.name,
      year: seasonYear,
    }));
  }

  async getDay(competition: number, dayNumber: number): Promise<Match[]> {
    const { group, seasonYear } = decodeCompetitionId(this.series, competition);
    // Senza elenco i loghi si cercano con l'estensione più comune.
    const logos = await this.loadTeams().catch(() => new Map<number, TeamListing>());
    const params = { task: 'schedule', year: seasonKey(seasonYear), league: group.key, round: dayNumber };
    try {
      const response = await this.http.get<ScheduleGameDto[] | { error: unknown }>(STATS_URL, params);
      // Una giornata inesistente risponde con un oggetto di errore (o con un 404) invece che con una lista.
      if (!Array.isArray(response)) return [];
      return response.flatMap((dto) => toMatch(dto, competition, logos) ?? []);
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) return [];
      throw error;
    }
  }

  async getBoxScore(id: number): Promise<MatchBoxScore> {
    const { group, seasonYear, gameNumber } = decodeMatchId(this.series, id);
    const season = seasonKey(seasonYear);
    try {
      const html = await this.http.getText(`${SITE_URL}/wp/match/${group.key}_${gameNumber}/${group.key}/${season}`);
      return parseBoxScore(html, season);
    } catch (error) {
      // Prima che la partita abbia dati la pagina non esiste.
      if (error instanceof HttpError && error.status === 404) return parseBoxScore('', season);
      throw error;
    }
  }

  async getRoster(teamId: number): Promise<Roster> {
    const listing = (await this.loadTeams()).get(teamId);
    if (!listing) throw new Error(`Scheda della squadra ${teamId} non trovata`);

    const html = await this.http.getText(`${SITE_URL}${listing.path}`);
    const page = parseTeamPage(html);
    const team = toTeamRef(teamId, page.name, listing.logoExtension);
    return {
      team,
      coach: page.coach ? toCoach(teamId, page.coach) : null,
      players: page.players.map((p) => ({ ...p, teamId, teamName: team.name })),
    };
  }

  private loadTeams(): Promise<Map<number, TeamListing>> {
    this.teams ??= this.http
      .getText(`${SITE_URL}${this.series.teamsPage}`)
      .then(parseTeamListing)
      .catch((error) => {
        this.teams = null;
        throw error;
      });
    return this.teams;
  }
}
