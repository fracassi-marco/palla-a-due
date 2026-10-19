import { GetCalendar } from '../application/GetCalendar';
import { GetCurrentRound } from '../application/GetCurrentRound';
import { GetMatch } from '../application/GetMatch';
import { GetMatchBoxScore } from '../application/GetMatchBoxScore';
import { GetPlayerProfile } from '../application/GetPlayerProfile';
import { GetStandings } from '../application/GetStandings';
import { GetTeamRoster } from '../application/GetTeamRoster';
import { GetTeamStats } from '../application/GetTeamStats';
import {
  ApiCompetitionRepository,
  ApiMatchRepository,
  ApiPlayerRepository,
  ApiStandingsRepository,
  ApiTeamRepository,
  FetchHttpClient,
} from '../infrastructure/api';
import { CachedHttpClient, defaultTtlPolicy, FileCacheStore } from '../infrastructure/cache';

const API_BASE_URL = 'https://www.legabasket.it/api';

/** Composition root: l'unico punto in cui le porte vengono legate alle implementazioni. */
const http = new CachedHttpClient(new FetchHttpClient(API_BASE_URL), new FileCacheStore(), defaultTtlPolicy);

const competitions = new ApiCompetitionRepository(http);
const matches = new ApiMatchRepository(http);
const standings = new ApiStandingsRepository(http);
const teams = new ApiTeamRepository(http);
const players = new ApiPlayerRepository(http);

const getCurrentRound = new GetCurrentRound(competitions, matches);

export const useCases = {
  getStandings: new GetStandings(competitions, standings),
  getCurrentRound,
  getCalendar: new GetCalendar(competitions, matches, standings, getCurrentRound),
  getMatch: new GetMatch(competitions, matches),
  getMatchBoxScore: new GetMatchBoxScore(matches),
  getTeamRoster: new GetTeamRoster(teams),
  getTeamStats: new GetTeamStats(teams, competitions, standings),
  getPlayerProfile: new GetPlayerProfile(players),
};
