import { useSyncExternalStore } from 'react';
import { useCases } from '../../di/container';

const { favoriteTeam } = useCases;

export function useFavoriteTeamId(): number | null {
  return useSyncExternalStore(favoriteTeam.subscribe, favoriteTeam.getSnapshot);
}

export const setFavoriteTeam = (teamId: number | null) => favoriteTeam.set(teamId);
