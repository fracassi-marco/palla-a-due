import { Match } from './entities';

/** Porta in testa le partite della squadra preferita, lasciando invariato l'ordine relativo del resto. */
export function favoriteFirst(matches: Match[], teamId: number | null): Match[] {
  if (teamId === null) return matches;
  const isFavorite = (m: Match) => m.home.id === teamId || m.away.id === teamId;
  return [...matches.filter(isFavorite), ...matches.filter((m) => !isFavorite(m))];
}
