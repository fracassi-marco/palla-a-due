import { HttpClient } from '../api/HttpClient';
import { nbaPlayoffMatchId } from './ids';
import { toTeamRef } from './mappers';
import { nbaTeamById } from './teams';
import { OfficialPlayoffSource } from './OfficialPlayoffSource';

/**
 * Playoff NBA dal CDN ufficiale: play-in (6 gare secche, 3 per conference, in un solo turno), primo turno (8 serie), semifinali (4) e finali (2) di conference, finale NBA, tutte al meglio delle 7.
 * Le etichette (`gameLabel`) sono quelle attese ("East First Round", "East Conf Semifinals", "West Conf Finals", "NBA Finals"): finora
 * il calendario non conteneva gare di playoff, quindi non sono state verificate. L'ordine conta: "Semifinals" va riconosciuta prima di "Finals".
 * `http` deve mandare `NBA_HEADERS`.
 */
export const nbaPlayoffs = (http: HttpClient) =>
  new OfficialPlayoffSource(http, {
    scheduleUrl: 'https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json',
    gameIdPrefixes: ['005', '004'],
    rounds: [
      { name: 'PLAY-IN', match: /play-?in/i, bestOf: 1, slots: 6 },
      { name: 'PRIMO TURNO', match: /first round/i, bestOf: 7, slots: 8 },
      { name: 'SEMIFINALI DI CONFERENCE', match: /semifinals/i, bestOf: 7, slots: 4 },
      { name: 'FINALI DI CONFERENCE', match: /(east|west).*finals/i, bestOf: 7, slots: 2 },
      { name: 'FINALE NBA', match: /nba finals/i, bestOf: 7, slots: 1 },
    ],
    teamById: (id) => {
      const team = nbaTeamById(id);
      return team && toTeamRef(team);
    },
    matchId: nbaPlayoffMatchId,
  });
