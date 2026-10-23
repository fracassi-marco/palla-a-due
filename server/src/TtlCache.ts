const FAILURE_TTL_MS = 10_000;
const MAX_ENTRIES = 2000;

interface Entry {
  at: number;
  ttlMs: number;
  result: Promise<unknown>;
  failed: boolean;
}

export interface Cached<T> {
  value: T;
  /** Quando il valore è stato scaricato (ms). */
  at: number;
}

/**
 * Cache in memoria con richieste simultanee unificate: N client sulla stessa partita producono un solo scaricamento.
 * Anche un errore resta in cache per qualche secondo, così una sorgente giù non viene martellata.
 */
export class TtlCache {
  private readonly entries = new Map<string, Entry>();

  async get<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<Cached<T>> {
    const now = Date.now();
    const current = this.entries.get(key);
    if (current && now - current.at < (current.failed ? FAILURE_TTL_MS : Math.min(current.ttlMs, ttlMs))) {
      return { value: (await current.result) as T, at: current.at };
    }

    const entry: Entry = { at: now, ttlMs, failed: false, result: load() };
    entry.result.catch(() => {
      entry.failed = true;
    });
    this.entries.set(key, entry);
    this.prune(now);
    return { value: (await entry.result) as T, at: now };
  }

  private prune(now: number) {
    if (this.entries.size <= MAX_ENTRIES) return;
    for (const [key, entry] of this.entries) if (now - entry.at >= entry.ttlMs) this.entries.delete(key);
  }
}
