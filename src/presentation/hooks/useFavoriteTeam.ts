import { useSyncExternalStore } from 'react';
import { favoriteTeam } from '../../di/container';

export function useFavoriteTeamId(): number | null {
  return useSyncExternalStore(favoriteTeam.subscribe, favoriteTeam.getSnapshot);
}

export const setFavoriteTeam = (teamId: number | null) => favoriteTeam.set(teamId);
