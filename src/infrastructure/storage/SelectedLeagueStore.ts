import Storage from 'expo-sqlite/kv-store';
import { DEFAULT_LEAGUE, isLeagueId, LeagueId } from '../../domain/League';

const KEY = 'selectedLeague';

type Listener = () => void;

/** Campionato mostrato dall'app, persistito in un key-value store separato dai database dei campionati. */
export class SelectedLeagueStore {
  private readonly listeners = new Set<Listener>();
  private current: LeagueId = readStored();

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.current;

  set(league: LeagueId) {
    if (league === this.current) return;
    this.current = league;
    try {
      Storage.setItemSync(KEY, league);
    } catch {
      // Senza persistenza il campionato torna quello predefinito al prossimo avvio.
    }
    this.listeners.forEach((l) => l());
  }
}

function readStored(): LeagueId {
  try {
    const raw = Storage.getItemSync(KEY);
    return isLeagueId(raw) ? raw : DEFAULT_LEAGUE;
  } catch {
    return DEFAULT_LEAGUE;
  }
}
