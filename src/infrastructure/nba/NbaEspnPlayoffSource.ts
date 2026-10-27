import { HttpClient } from '../api/HttpClient';
import { EspnPlayoffSource } from '../espn/EspnPlayoffSource';
import { toTeamRef } from './mappers';
import { nbaTeamByEspnCode } from './teams';

/** Playoff NBA: 8 serie al primo turno, 4 semifinali e 2 finali di conference, la finale NBA, tutte al meglio delle 7. La stagione ESPN è l'anno di fine. */
export const nbaEspnPlayoffs = (http: HttpClient) =>
  new EspnPlayoffSource(http, {
    scoreboardUrl: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
    espnYear: (seasonYear) => seasonYear + 1,
    rounds: [
      { name: 'PRIMO TURNO', match: /1st round/i, bestOf: 7, slots: 8 },
      { name: 'SEMIFINALI DI CONFERENCE', match: /semifinals/i, bestOf: 7, slots: 4 },
      { name: 'FINALI DI CONFERENCE', match: /(east|west) finals/i, bestOf: 7, slots: 2 },
      { name: 'FINALE NBA', match: /nba finals/i, bestOf: 7, slots: 1 },
    ],
    teamByEspnCode: (code) => {
      const team = nbaTeamByEspnCode(code);
      return team && toTeamRef(team);
    },
  });
