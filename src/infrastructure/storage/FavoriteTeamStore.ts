import Storage from 'expo-sqlite/kv-store';

const KEY = 'favoriteTeamId';

type Listener = () => void;

/** Squadra preferita, persistita in un key-value store separato dal database del campionato. */
export class FavoriteTeamStore {
  private readonly listeners = new Set<Listener>();
  private current: number | null = readStored();

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.current;

  set(teamId: number | null) {
    this.current = teamId;
    if (teamId === null) Storage.removeItemSync(KEY);
    else Storage.setItemSync(KEY, String(teamId));
    this.listeners.forEach((l) => l());
  }
}

function readStored(): number | null {
  try {
    const raw = Storage.getItemSync(KEY);
    const id = raw === null ? NaN : Number(raw);
    return Number.isInteger(id) ? id : null;
  } catch {
    return null;
  }
}
