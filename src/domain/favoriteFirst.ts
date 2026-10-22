import { Match } from './entities';

/** Porta in testa le partite della squadra preferita, lasciando invariato l'ordine relativo del resto. */
export function favoriteFirst(matches: Match[], teamId: number | null): Match[] {
  if (teamId === null) return matches;
  const isFavorite = (m: Match) => m.home.id === teamId || m.away.id === teamId;
  return [...matches.filter(isFavorite), ...matches.filter((m) => !isFavorite(m))];
}

/** Porta in testa il girone o la conference che contiene la squadra preferita, lasciando invariato l'ordine del resto. */
export function favoriteGroupFirst<T extends { standings: { team: { id: number } }[] }>(groups: T[], teamId: number | null): T[] {
  if (teamId === null) return groups;
  const isFavorite = (g: T) => g.standings.some((row) => row.team.id === teamId);
  return [...groups.filter(isFavorite), ...groups.filter((g) => !isFavorite(g))];
}
