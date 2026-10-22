import { GetCalendar } from '../application/GetCalendar';
import { GetCurrentRound } from '../application/GetCurrentRound';
import { GetLeagueRanking } from '../application/GetLeagueRanking';
import { GetMatch } from '../application/GetMatch';
import { GetMatchBoxScore } from '../application/GetMatchBoxScore';
import { GetPlayerProfile } from '../application/GetPlayerProfile';
import { GetStandings } from '../application/GetStandings';
import { GetTeamRoster } from '../application/GetTeamRoster';
import { GetTeamStats } from '../application/GetTeamStats';
import { currentSeasonYear } from '../application/season';
import { SyncLeague } from '../application/SyncLeague';
import { LEAGUES, LeagueId, leagueInfo } from '../domain/League';
import { LeagueSource, MatchRepository } from '../domain/ports';
import { ApiLeagueSource, FetchHttpClient, HttpClient } from '../infrastructure/api';
import {
  ExpoSqliteDatabase,
  SqliteCompetitionRepository,
  SqliteLeagueStore,
  SqliteMatchRepository,
  SqlitePlayerRepository,
  SqliteStandingsRepository,
  SqliteTeamRepository,
} from '../infrastructure/db';
import { EuroleagueLeagueSource } from '../infrastructure/euroleague/EuroleagueLeagueSource';
import { EuroleagueV1LeagueSource } from '../infrastructure/euroleague/EuroleagueV1LeagueSource';
import { EUROCUP, EUROLEAGUE, EuroleagueSeries } from '../infrastructure/euroleague/series';
import { FallbackLeagueSource } from '../infrastructure/fallback/FallbackLeagueSource';
import { LnpLeagueSource } from '../infrastructure/lnp/LnpLeagueSource';
import { LNP_A2, LNP_B } from '../infrastructure/lnp/series';
import { FavoriteTeamStore } from '../infrastructure/storage/FavoriteTeamStore';
import { SelectedLeagueStore } from '../infrastructure/storage/SelectedLeagueStore';
import { TheSportsDbLeagueSource } from '../infrastructure/thesportsdb/TheSportsDbLeagueSource';

const LBA_API_BASE_URL = 'https://www.legabasket.it/api';

/** Ogni campionato ha il suo database: gli id di LBA, LNP ed Euroleague, e quelli delle stagioni, non devono mescolarsi. */
const DATABASE_NAMES: Record<LeagueId, string> = {
  lba: 'pallaadue.db',
  a2: 'pallaadue-a2.db',
  b: 'pallaadue-b.db',
  euroleague: 'pallaadue-euroleague.db',
  eurocup: 'pallaadue-eurocup.db',
};

/** Id delle leghe su TheSportsDB (backup di calendario e punteggi per i campionati con una sola fonte). */
const THESPORTSDB_LEAGUE = { lba: 4433, a2: 5377 } as const;

const createSource = (league: LeagueId, matches: MatchRepository): LeagueSource => {
  const http = new FetchHttpClient();
  const sportsDb = (id: number) => new TheSportsDbLeagueSource(http, matches, id, currentSeasonYear);
  switch (league) {
    case 'lba':
      return new FallbackLeagueSource(new ApiLeagueSource(new FetchHttpClient(LBA_API_BASE_URL)), [
        sportsDb(THESPORTSDB_LEAGUE.lba),
      ]);
    case 'a2':
      return new FallbackLeagueSource(new LnpLeagueSource(http, LNP_A2), [sportsDb(THESPORTSDB_LEAGUE.a2)]);
    case 'b':
      return new LnpLeagueSource(http, LNP_B);
    case 'euroleague':
      return euroleagueSource(http, EUROLEAGUE);
    case 'eurocup':
      return euroleagueSource(http, EUROCUP);
  }
};

const euroleagueSource = (http: HttpClient, series: EuroleagueSeries) =>
  new FallbackLeagueSource(new EuroleagueLeagueSource(http, series, currentSeasonYear), [
    new EuroleagueV1LeagueSource(http, series, currentSeasonYear),
  ]);

/**
 * Casi d'uso di un campionato. Le schermate leggono solo dal suo database locale;
 * la rete è usata soltanto da SyncLeague.
 */
function createUseCases(league: LeagueId) {
  const database = new ExpoSqliteDatabase(DATABASE_NAMES[league]);

  const competitions = new SqliteCompetitionRepository(database);
  const matches = new SqliteMatchRepository(database);
  const standings = new SqliteStandingsRepository(database, leagueInfo(league));
  const teams = new SqliteTeamRepository(database);
  const players = new SqlitePlayerRepository(database);

  const getCurrentRound = new GetCurrentRound(competitions, matches);

  return {
    sync: new SyncLeague(createSource(league, matches), new SqliteLeagueStore(database)),
    getStandings: new GetStandings(competitions, standings),
    getCurrentRound,
    getCalendar: new GetCalendar(competitions, matches, standings, getCurrentRound),
    getMatch: new GetMatch(competitions, matches),
    getMatchBoxScore: new GetMatchBoxScore(matches),
    getTeamRoster: new GetTeamRoster(teams),
    getTeamStats: new GetTeamStats(teams, competitions, standings),
    getPlayerProfile: new GetPlayerProfile(players),
    getLeagueRanking: new GetLeagueRanking(players),
  };
}

type UseCases = ReturnType<typeof createUseCases>;

/** Composition root: l'unico punto in cui le porte vengono legate alle implementazioni. */
export const selectedLeague = new SelectedLeagueStore();
export const favoriteTeam = new FavoriteTeamStore(selectedLeague);

// Il database di un campionato si apre (e il suo schema si aggiorna) solo quando lo si seleziona la prima volta.
const byLeague = new Map<LeagueId, UseCases>();

function casesOf(league: LeagueId): UseCases {
  let current = byLeague.get(league);
  if (!current) {
    current = createUseCases(league);
    byLeague.set(league, current);
  }
  return current;
}

/** Apre in background i database degli altri campionati, così cambiando non si attende né l'apertura né la lettura dello stato. */
export function warmUpLeagues(): void {
  for (const { id } of LEAGUES) void casesOf(id).sync.loadReadiness().catch(() => {});
}

/** Casi d'uso del campionato selezionato: ogni accesso risolve quello corrente, quindi non vanno tenuti da parte. */
export const useCases: UseCases = new Proxy({} as UseCases, {
  get(_target, name: keyof UseCases) {
    return casesOf(selectedLeague.getSnapshot())[name];
  },
});
