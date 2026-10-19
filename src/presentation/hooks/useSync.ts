import { useSyncExternalStore } from 'react';
import { SyncState } from '../../application/SyncLeague';
import { useCases } from '../../di/container';

const { sync } = useCases;

export function useSyncState(): SyncState {
  return useSyncExternalStore(sync.subscribe, sync.getState);
}

/** Cambia quando il database riceve dati nuovi: da mettere tra le dipendenze di `useAsync` per rileggerlo. */
export function useDataVersion(): number {
  return useSyncExternalStore(sync.subscribe, () => sync.getState().dataVersion);
}

/** Cambia solo quando vengono salvati box score: per le schermate che aggregano le statistiche dei giocatori. */
export function useStatsVersion(): number {
  return useSyncExternalStore(sync.subscribe, () => sync.getState().statsVersion);
}
