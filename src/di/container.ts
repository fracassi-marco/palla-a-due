import { GetCurrentRound } from '../application/GetCurrentRound';
import { GetPlayerProfile } from '../application/GetPlayerProfile';
import { GetStandings } from '../application/GetStandings';
import { GetTeamRoster } from '../application/GetTeamRoster';
import {
  ApiCompetitionRepository,
  ApiMatchRepository,
  ApiPlayerRepository,
  ApiStandingsRepository,
  ApiTeamRepository,
  FetchHttpClient,
} from '../infrastructure/api';

const API_BASE_URL = 'https://www.legabasket.it/api';

/** Composition root: l'unico punto in cui le porte vengono legate alle implementazioni. */
const http = new FetchHttpClient(API_BASE_URL);

const competitions = new ApiCompetitionRepository(http);
const matches = new ApiMatchRepository(http);
const standings = new ApiStandingsRepository(http);
const teams = new ApiTeamRepository(http);
const players = new ApiPlayerRepository(http);

export const useCases = {
  getStandings: new GetStandings(competitions, standings),
  getCurrentRound: new GetCurrentRound(competitions, matches),
  getTeamRoster: new GetTeamRoster(teams),
  getPlayerProfile: new GetPlayerProfile(players),
};
