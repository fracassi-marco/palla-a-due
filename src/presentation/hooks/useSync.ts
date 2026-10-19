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
