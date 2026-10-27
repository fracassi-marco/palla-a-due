import { HttpClient } from '../api/HttpClient';
import { OfficialPlayoffSource } from '../nba/OfficialPlayoffSource';
import { toTeamRef } from './mappers';
import { wnbaTeamById } from './teams';

/** Playoff WNBA dal CDN ufficiale: primo turno (al meglio delle 3), semifinali (5), finale (7). `http` deve mandare `NBA_HEADERS`. */
export const wnbaPlayoffs = (http: HttpClient) =>
  new OfficialPlayoffSource(http, {
    scheduleUrl: 'https://cdn.wnba.com/static/json/staticData/scheduleLeagueV2.json',
    gameIdPrefix: '104',
    rounds: [
      { name: 'PRIMO TURNO', match: /first round/i, bestOf: 3, slots: 4 },
      { name: 'SEMIFINALI', match: /semifinal/i, bestOf: 5, slots: 2 },
      { name: 'FINALE', match: /finals/i, bestOf: 7, slots: 1 },
    ],
    teamById: (id) => {
      const team = wnbaTeamById(id);
      return team && toTeamRef(team);
    },
  });
