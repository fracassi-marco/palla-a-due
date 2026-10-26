import { GetCalendar } from '../application/GetCalendar';
import { GetCurrentRound } from '../application/GetCurrentRound';
import { GetLeagueRanking } from '../application/GetLeagueRanking';
import { GetMatch } from '../application/GetMatch';
import { GetMatchBoxScore } from '../application/GetMatchBoxScore';
import { GetPlayerProfile } from '../application/GetPlayerProfile';
import { GetStandings } from '../application/GetStandings';
import { GetTeamRoster } from '../application/GetTeamRoster';
import { GetTeamStats } from '../application/GetTeamStats';
import { SyncLeague } from '../application/SyncLeague';
import { LEAGUES, LeagueId, leagueInfo } from '../domain/League';
import { MatchRepository } from '../domain/ports';
import { FetchHttpClient } from '../infrastructure/api';
import { BackendLeagueSource } from '../infrastructure/backend';
import {
  ExpoSqliteDatabase,
  SqliteCompetitionRepository,
  SqliteLeagueStore,
  SqliteMatchRepository,
  SqlitePlayerRepository,
  SqliteStandingsRepository,
  SqliteTeamRepository,
} from '../infrastructure/db';
import { FavoriteTeamStore } from '../infrastructure/storage/FavoriteTeamStore';
import { SelectedLeagueStore } from '../infrastructure/storage/SelectedLeagueStore';
import { createSource } from './createSource';

/**
 * Base URL del nostro backend (`server/`). Con `EXPO_PUBLIC_API_URL` vuoto la app usa solo le sorgenti dirette.
 * Il valore è incorporato nella build, quindi non va messo nulla di segreto.
 */
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://043q46l.cserverhost.cloud';
const API_TIMEOUT_MS = 8000;
/** Campionati serviti dal backend: tutti. */
const BACKEND_LEAGUES: readonly LeagueId[] = ['lba', 'a2', 'b', 'euroleague', 'eurocup', 'nba', 'wnba'];

/** I campionati migrati leggono solo dal backend, senza ripiegare sulle sorgenti esterne. Senza URL (sviluppo) vanno direttamente alle sorgenti. */
function createLeagueSource(league: LeagueId, matches: MatchRepository) {
  if (!API_BASE_URL || !BACKEND_LEAGUES.includes(league)) return createSource(league, matches);
  return new BackendLeagueSource(new FetchHttpClient(API_BASE_URL, {}, API_TIMEOUT_MS), league);
}

/** Ogni campionato ha il suo database: gli id di LBA, LNP ed Euroleague, e quelli delle stagioni, non devono mescolarsi. */
const DATABASE_NAMES: Record<LeagueId, string> = {
  lba: 'pallaadue.db',
  a2: 'pallaadue-a2.db',
  b: 'pallaadue-b.db',
  euroleague: 'pallaadue-euroleague.db',
  eurocup: 'pallaadue-eurocup.db',
  nba: 'pallaadue-nba.db',
  wnba: 'pallaadue-wnba.db',
};

/**
 * Casi d'uso di un campionato. Le schermate leggono solo dal suo database locale;
 * la rete è usata soltanto da SyncLeague.
 */
function createUseCases(league: LeagueId) {
  const database = new ExpoSqliteDatabase(DATABASE_NAMES[league]);

  const competitions = new SqliteCompetitionRepository(database);
  const matches = new SqliteMatchRepository(database);
  const info = leagueInfo(league);
  // Con le conference la classifica generale resta senza zone: posizioni e zone si assegnano a ogni conference (GetStandings).
  const standings = new SqliteStandingsRepository(
    database,
    info.conferences ? { playoffSpots: 0, relegationSpots: 0, byWinPercentage: info.byWinPercentage } : info,
  );
  const teams = new SqliteTeamRepository(database);
  const players = new SqlitePlayerRepository(database);

  const getCurrentRound = new GetCurrentRound(competitions, matches);

  return {
    sync: new SyncLeague(createLeagueSource(league, matches), new SqliteLeagueStore(database)),
    getStandings: new GetStandings(competitions, standings, info),
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
