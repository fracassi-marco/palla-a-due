export interface CacheEntry {
  data: unknown;
  /** Timestamp (ms) oltre il quale il dato è considerato scaduto. */
  expiresAt: number;
}

export interface CacheStore {
  get(key: string): Promise<CacheEntry | null>;
  set(key: string, entry: CacheEntry): Promise<void>;
}
