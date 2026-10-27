import { HttpClient } from '../api/HttpClient';
import { EspnPlayoffSource } from '../espn/EspnPlayoffSource';
import { toTeamRef } from './mappers';
import { wnbaTeamByEspnCode } from './teams';

/** Playoff WNBA a 8 squadre: primo turno (al meglio delle 3), semifinali (5), finale (7). La stagione ESPN è l'anno solare. */
export const wnbaEspnPlayoffs = (http: HttpClient) =>
  new EspnPlayoffSource(http, {
    scoreboardUrl: 'https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/scoreboard',
    espnYear: (seasonYear) => seasonYear,
    rounds: [
      { name: 'PRIMO TURNO', match: /first round/i, bestOf: 3, slots: 4 },
      { name: 'SEMIFINALI', match: /semifinal/i, bestOf: 5, slots: 2 },
      { name: 'FINALE', match: /finals/i, bestOf: 7, slots: 1 },
    ],
    teamByEspnCode: (code) => {
      const team = wnbaTeamByEspnCode(code);
      return team && toTeamRef(team);
    },
  });
