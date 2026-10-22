import { NbaTeam, teamAtIndex, teamIndex } from './teams';

/**
 * L'API NBA identifica le partite con un `gameId` ("0022600001") che ESPN, il backup, non conosce: l'id numerico dell'app
 * si ricava invece da ciò che entrambe le fonti sanno, data della partita (ora della costa Est, quella di `gameCode`)
 * e squadre. In una giornata due squadre non si incontrano mai due volte, quindi l'id è unico e le due fonti producono
 * lo stesso id per la stessa partita. Si decodifica per risalire al `gameCode` ("20261020/BOSDET": ospiti, poi casa).
 *
 * partita = AAAAMMGG * 10000 + indice squadra di casa * 100 + indice ospiti (indici in `teams.ts`).
 */
const DATE_SPACE = 10_000;

/** Id della competizione: come per le altre leghe, anno a 2 cifre per 10 (+ girone, qui sempre 1). */
export const competitionId = (seasonYear: number) => (seasonYear % 100) * 10 + 1;

/** `date` è AAAAMMGG, in ora della costa Est. */
export const matchId = (date: string, home: NbaTeam, away: NbaTeam) =>
  Number(date) * DATE_SPACE + teamIndex(home) * 100 + teamIndex(away);

export function decodeMatchId(id: number): { date: string; home: NbaTeam; away: NbaTeam } {
  const date = String(Math.floor(id / DATE_SPACE));
  const home = teamAtIndex(Math.floor((id % DATE_SPACE) / 100));
  const away = teamAtIndex(id % 100);
  if (!home || !away || date.length !== 8) throw new Error(`Id partita NBA non valido: ${id}`);
  return { date, home, away };
}

/** "20261020/BOSDET": data, ospiti, casa. */
export const gameCode = (date: string, home: NbaTeam, away: NbaTeam) => `${date}/${away.code}${home.code}`;
