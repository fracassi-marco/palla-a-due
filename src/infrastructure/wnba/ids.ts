import { TeamRef } from '../../domain/entities';
import { teamAtIndex, teamIndex, WnbaTeam, wnbaTeamById } from './teams';
import { easternDate } from './weeks';

/**
 * L'API NBA identifica le partite con un `gameId` ("1022600101") che ESPN, il backup, non conosce: l'id numerico dell'app
 * si ricava invece da ciò che entrambe le fonti sanno, data della partita (ora della costa Est, quella di `gameCode`)
 * e squadre, come per la NBA (`nba/ids.ts`). In una giornata due squadre non si incontrano mai due volte.
 * Si decodifica per risalire al `gameCode` ("20260614/WASNYL": ospiti, poi casa).
 *
 * partita = AAAAMMGG * 10000 + indice squadra di casa * 100 + indice ospiti (indici in `teams.ts`).
 */
const DATE_SPACE = 10_000;

/** Id della competizione: come per le altre leghe, anno a 2 cifre per 10 (+ girone, qui sempre 1). */
export const competitionId = (seasonYear: number) => (seasonYear % 100) * 10 + 1;

/** Competizione che raccoglie i playoff della stessa stagione. */
export const playoffCompetitionId = (seasonYear: number) => (seasonYear % 100) * 10 + 2;

/** `date` è AAAAMMGG, in ora della costa Est. */
export const matchId = (date: string, home: WnbaTeam, away: WnbaTeam) =>
  Number(date) * DATE_SPACE + teamIndex(home) * 100 + teamIndex(away);

export function decodeMatchId(id: number): { date: string; home: WnbaTeam; away: WnbaTeam } {
  const date = String(Math.floor(id / DATE_SPACE));
  const home = teamAtIndex(Math.floor((id % DATE_SPACE) / 100));
  const away = teamAtIndex(id % 100);
  if (!home || !away || date.length !== 8) throw new Error(`Id partita WNBA non valido: ${id}`);
  return { date, home, away };
}

/** "20260614/WASNYL": data, ospiti, casa. */
export const gameCode = (date: string, home: WnbaTeam, away: WnbaTeam) => `${date}/${away.code}${home.code}`;

/** Id della partita di playoff dagli attori noti al tabellone: gli stessi che la Regular Season ricava dal calendario. */
export function wnbaPlayoffMatchId(startsAt: Date, home: TeamRef, away: TeamRef): number {
  return matchId(easternDate(startsAt.toISOString()), wnbaTeamById(home.id)!, wnbaTeamById(away.id)!);
}
