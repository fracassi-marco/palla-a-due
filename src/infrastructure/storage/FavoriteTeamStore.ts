import Storage from 'expo-sqlite/kv-store';
import { LeagueId } from '../../domain/League';
import { SelectedLeagueStore } from './SelectedLeagueStore';

/** Le chiavi cambiano per campionato (gli id squadra di campionati diversi non c'entrano tra loro); la LBA tiene quella storica. */
const key = (league: LeagueId) => (league === 'lba' ? 'favoriteTeamId' : `favoriteTeamId:${league}`);

type Listener = () => void;

/** Squadra preferita di ogni campionato, persistita in un key-value store separato dai database; segue il campionato selezionato. */
export class FavoriteTeamStore {
  private readonly listeners = new Set<Listener>();
  private readonly cache = new Map<LeagueId, number | null>();

  constructor(private readonly leagues: SelectedLeagueStore) {}

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    const unsubscribeLeague = this.leagues.subscribe(listener);
    return () => {
      this.listeners.delete(listener);
      unsubscribeLeague();
    };
  };

  getSnapshot = () => this.read(this.leagues.getSnapshot());

  set(teamId: number | null) {
    const league = this.leagues.getSnapshot();
    this.cache.set(league, teamId);
    if (teamId === null) Storage.removeItemSync(key(league));
    else Storage.setItemSync(key(league), String(teamId));
    this.listeners.forEach((l) => l());
  }

  private read(league: LeagueId): number | null {
    if (!this.cache.has(league)) this.cache.set(league, readStored(league));
    return this.cache.get(league) ?? null;
  }
}

function readStored(league: LeagueId): number | null {
  try {
    const raw = Storage.getItemSync(key(league));
    const id = raw === null ? NaN : Number(raw);
    return Number.isInteger(id) ? id : null;
  } catch {
    return null;
  }
}
