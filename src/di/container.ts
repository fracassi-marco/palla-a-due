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
import { ApiLeagueSource, FetchHttpClient } from '../infrastructure/api';
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

const API_BASE_URL = 'https://www.legabasket.it/api';

/**
 * Composition root: l'unico punto in cui le porte vengono legate alle implementazioni.
 * Le schermate leggono solo dal database locale; la rete è usata soltanto da SyncLeague.
 */
const database = new ExpoSqliteDatabase();

const competitions = new SqliteCompetitionRepository(database);
const matches = new SqliteMatchRepository(database);
const standings = new SqliteStandingsRepository(database);
const teams = new SqliteTeamRepository(database);
const players = new SqlitePlayerRepository(database);

const getCurrentRound = new GetCurrentRound(competitions, matches);

export const useCases = {
  sync: new SyncLeague(new ApiLeagueSource(new FetchHttpClient(API_BASE_URL)), new SqliteLeagueStore(database)),
  getStandings: new GetStandings(competitions, standings),
  getCurrentRound,
  getCalendar: new GetCalendar(competitions, matches, standings, getCurrentRound),
  getMatch: new GetMatch(competitions, matches),
  getMatchBoxScore: new GetMatchBoxScore(matches),
  getTeamRoster: new GetTeamRoster(teams),
  getTeamStats: new GetTeamStats(teams, competitions, standings),
  getPlayerProfile: new GetPlayerProfile(players),
  getLeagueRanking: new GetLeagueRanking(players),
  favoriteTeam: new FavoriteTeamStore(),
};
