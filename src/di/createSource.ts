import { currentSeasonYear } from '../application/season';
import { LeagueId } from '../domain/League';
import { LeagueSource, MatchRepository, PlayoffSource } from '../domain/ports';
import { ApiLeagueSource, FetchHttpClient, HttpClient } from '../infrastructure/api';
import { EuroleagueLeagueSource } from '../infrastructure/euroleague/EuroleagueLeagueSource';
import { EuroleagueV1LeagueSource } from '../infrastructure/euroleague/EuroleagueV1LeagueSource';
import { EUROCUP, EUROLEAGUE, EuroleagueSeries } from '../infrastructure/euroleague/series';
import { FallbackPlayoffSource } from '../infrastructure/fallback/FallbackPlayoffSource';
import { FallbackLeagueSource } from '../infrastructure/fallback/FallbackLeagueSource';
import { LnpLeagueSource } from '../infrastructure/lnp/LnpLeagueSource';
import { LNP_A2, LNP_B } from '../infrastructure/lnp/series';
import { nbaEspnPlayoffs } from '../infrastructure/nba/NbaEspnPlayoffSource';
import { NbaEspnLeagueSource } from '../infrastructure/nba/NbaEspnLeagueSource';
import { NBA_HEADERS, NbaLeagueSource } from '../infrastructure/nba/NbaLeagueSource';
import { WnbaEspnLeagueSource } from '../infrastructure/wnba/WnbaEspnLeagueSource';
import { wnbaEspnPlayoffs } from '../infrastructure/wnba/WnbaEspnPlayoffSource';
import { wnbaPlayoffs } from '../infrastructure/wnba/WnbaPlayoffSource';
import { WnbaLeagueSource } from '../infrastructure/wnba/WnbaLeagueSource';
import { TheSportsDbLeagueSource } from '../infrastructure/thesportsdb/TheSportsDbLeagueSource';

const LBA_API_BASE_URL = 'https://www.legabasket.it/api';

/** Id delle leghe su TheSportsDB (backup di calendario e punteggi per i campionati con una sola fonte). */
const THESPORTSDB_LEAGUE = { lba: 4433, a2: 5377 } as const;

/** Sorgente remota di un campionato, con i suoi backup: la usano sia la app sia i cron del server. */
export const createSource = (league: LeagueId, matches: MatchRepository): LeagueSource => {
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
    case 'nba':
      return new FallbackLeagueSource(new NbaLeagueSource(new FetchHttpClient('', NBA_HEADERS)), [new NbaEspnLeagueSource(http)]);
    case 'wnba':
      return new FallbackLeagueSource(new WnbaLeagueSource(new FetchHttpClient('', NBA_HEADERS)), [new WnbaEspnLeagueSource(http)]);
  }
};

/** Fonte del tabellone playoff di un campionato, se la app lo sa mostrare. */
export function createPlayoffSource(league: LeagueId): PlayoffSource | null {
  switch (league) {
    case 'nba':
      return nbaEspnPlayoffs(new FetchHttpClient());
    case 'wnba':
      return new FallbackPlayoffSource(wnbaPlayoffs(new FetchHttpClient('', NBA_HEADERS)), [wnbaEspnPlayoffs(new FetchHttpClient())]);
    default:
      return null;
  }
}

const euroleagueSource = (http: HttpClient, series: EuroleagueSeries) =>
  new FallbackLeagueSource(new EuroleagueLeagueSource(http, series, currentSeasonYear), [
    new EuroleagueV1LeagueSource(http, series, currentSeasonYear),
  ]);
