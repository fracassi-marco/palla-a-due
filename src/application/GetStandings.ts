import { StandingsGroup } from '../domain/entities';
import { LeagueInfo } from '../domain/League';
import { CompetitionRepository, StandingsRepository } from '../domain/ports';
import { splitByConference } from '../domain/standings';
import { currentSeasonYear } from './season';

export class GetStandings {
  constructor(
    private readonly competitions: CompetitionRepository,
    private readonly standings: StandingsRepository,
    private readonly league: LeagueInfo,
  ) {}

  /** Una classifica per competizione della stagione corrente (più d'una solo con i gironi), o per conference se la lega le ha. */
  async execute(): Promise<StandingsGroup[]> {
    const competitions = await this.competitions.getSeasonCompetitions(currentSeasonYear());
    const groups = await Promise.all(
      competitions.map(async (c) => ({
        competitionId: c.id,
        name: c.name,
        standings: await this.standings.getStandings(c.id),
      })),
    );
    const { conferences } = this.league;
    if (!conferences) return groups;
    return groups.flatMap((group) =>
      splitByConference(group.standings, conferences, this.league).map((conference) => ({ ...group, ...conference })),
    );
  }
}
