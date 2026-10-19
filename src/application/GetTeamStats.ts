import { Standing, Streak, TeamResult, TeamStats, WinLoss } from '../domain/entities';
import { CompetitionRepository, StandingsRepository, TeamRepository } from '../domain/ports';
import { currentSeasonYear } from './season';

const FORM_LENGTH = 5;

function record(results: TeamResult[]): WinLoss {
  const wins = results.filter((r) => r.won).length;
  return { wins, losses: results.length - wins };
}

/** Serie in corso, calcolata dal risultato più recente all'indietro. */
function currentStreak(results: TeamResult[]): Streak | null {
  const last = results[results.length - 1];
  if (!last) return null;
  let length = 0;
  for (let i = results.length - 1; i >= 0 && results[i].won === last.won; i--) length++;
  return { won: last.won, length };
}

const margin = (r: TeamResult) => r.teamScore - r.opponentScore;

function best(results: TeamResult[], score: (r: TeamResult) => number): TeamResult | null {
  return results.reduce<TeamResult | null>((acc, r) => (acc === null || score(r) > score(acc) ? r : acc), null);
}

/** 1 = la squadra che subisce meno punti. */
function defenseRank(standings: Standing[], teamId: number): number | null {
  const own = standings.find((s) => s.team.id === teamId);
  if (!own) return null;
  return standings.filter((s) => s.avgPointsAgainst < own.avgPointsAgainst).length + 1;
}

export class GetTeamStats {
  constructor(
    private readonly teams: TeamRepository,
    private readonly competitions: CompetitionRepository,
    private readonly standings: StandingsRepository,
  ) {}

  /** Null se la squadra non ha ancora giocato partite. */
  async execute(teamId: number, now: Date = new Date()): Promise<TeamStats | null> {
    const seasonYear = currentSeasonYear(now);
    const [season, results, standings] = await Promise.all([
      this.teams.getSeasonStats(teamId, seasonYear),
      this.teams.getResults(teamId, seasonYear),
      this.currentStandings(seasonYear),
    ]);
    if (!season || results.length === 0) return null;

    const played = results.length;
    const pointsFor = results.reduce((sum, r) => sum + r.teamScore, 0);
    const pointsAgainst = results.reduce((sum, r) => sum + r.opponentScore, 0);
    const own = standings.find((s) => s.team.id === teamId);
    const wins = results.filter((r) => r.won).length;

    return {
      teamId,
      seasonYear,
      position: own?.position ?? season.position,
      leaguePoints: own?.points ?? season.leaguePoints,
      played,
      wins,
      losses: played - wins,
      home: record(results.filter((r) => r.isHome)),
      away: record(results.filter((r) => !r.isHome)),
      streak: currentStreak(results),
      form: results.slice(-FORM_LENGTH).reverse(),
      avgPointsFor: { position: season.pointsRank, value: season.avgPoints },
      avgPointsAgainst: { position: defenseRank(standings, teamId), value: pointsAgainst / played },
      avgMargin: (pointsFor - pointsAgainst) / played,
      totalRebounds: { position: season.reboundsRank, value: season.avgOffensiveRebounds + season.avgDefensiveRebounds },
      offensiveRebounds: season.avgOffensiveRebounds,
      defensiveRebounds: season.avgDefensiveRebounds,
      assists: { position: season.assistsRank, value: season.avgAssists },
      steals: season.avgSteals,
      blocks: season.avgBlocks,
      turnovers: season.avgTurnovers,
      fouls: season.avgFouls,
      rating: season.avgRating,
      twoPercent: season.twoPercent,
      threePercent: season.threePercent,
      freeThrowPercent: season.freeThrowPercent,
      biggestWin: best(results.filter((r) => r.won), margin),
      biggestLoss: best(results.filter((r) => !r.won), (r) => -margin(r)),
      highestScore: best(results, (r) => r.teamScore),
    };
  }

  /** La classifica serve solo per posizione e difesa: se manca, la schermata funziona comunque. */
  private async currentStandings(seasonYear: number): Promise<Standing[]> {
    try {
      const competition = await this.competitions.getCurrentRegularSeason(seasonYear);
      return await this.standings.getStandings(competition.id);
    } catch {
      return [];
    }
  }
}
