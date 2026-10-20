import { useSyncExternalStore } from 'react';
import { selectedLeague } from '../../di/container';
import { LeagueId } from '../../domain/League';

export function useLeague(): LeagueId {
  return useSyncExternalStore(selectedLeague.subscribe, selectedLeague.getSnapshot);
}

export const setLeague = (league: LeagueId) => selectedLeague.set(league);
