import { useSyncExternalStore } from 'react';
import { SyncState } from '../../application/SyncLeague';
import { selectedLeague, useCases } from '../../di/container';

/** Ascolta la sincronizzazione del campionato selezionato, e passa a quella del nuovo quando si cambia campionato. */
function subscribe(listener: () => void) {
  let unsubscribe = useCases.sync.subscribe(listener);
  const unsubscribeLeague = selectedLeague.subscribe(() => {
    unsubscribe();
    unsubscribe = useCases.sync.subscribe(listener);
    listener();
  });
  return () => {
    unsubscribe();
    unsubscribeLeague();
  };
}

export function useSyncState(): SyncState {
  return useSyncExternalStore(subscribe, () => useCases.sync.getState());
}

/**
 * Cambia quando il database riceve dati nuovi o si cambia campionato: da mettere tra le dipendenze di `useAsync`
 * per rileggerlo.
 */
export function useDataVersion(): string {
  return useSyncExternalStore(subscribe, () => `${selectedLeague.getSnapshot()}:${useCases.sync.getState().dataVersion}`);
}

/** Come `useDataVersion`, ma cambia solo quando vengono salvati box score o roster: per le schermate che aggregano le statistiche dei giocatori. */
export function useStatsVersion(): string {
  return useSyncExternalStore(subscribe, () => `${selectedLeague.getSnapshot()}:${useCases.sync.getState().statsVersion}`);
}
