import { HttpClient } from '../api/HttpClient';
import { CacheStore } from './CacheStore';
import { TtlPolicy } from './cachePolicy';

type Params = Record<string, string | number | boolean>;

/**
 * Decorator di HttpClient con cache su store persistente. Le richieste identiche in volo
 * sono unificate e, se la rete fallisce, si ripiega sull'ultimo dato salvato anche se scaduto.
 */
export class CachedHttpClient implements HttpClient {
  private readonly memory = new Map<string, { data: unknown; expiresAt: number }>();
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(
    private readonly inner: HttpClient,
    private readonly store: CacheStore,
    private readonly ttlPolicy: TtlPolicy,
  ) {}

  get<T>(path: string, params: Params = {}): Promise<T> {
    const key = cacheKey(path, params);
    const pending = this.inFlight.get(key);
    if (pending) return pending as Promise<T>;

    const request = this.load<T>(key, path, params).finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, request);
    return request;
  }

  private async load<T>(key: string, path: string, params: Params): Promise<T> {
    const cached = this.memory.get(key) ?? (await this.store.get(key));
    if (cached && cached.expiresAt > Date.now()) {
      this.memory.set(key, cached);
      return cached.data as T;
    }

    try {
      const data = await this.inner.get<T>(path, params);
      const ttl = this.ttlPolicy(path, data);
      if (ttl > 0) {
        const entry = { data, expiresAt: Date.now() + ttl };
        this.memory.set(key, entry);
        await this.store.set(key, entry);
      }
      return data;
    } catch (error) {
      if (cached) return cached.data as T;
      throw error;
    }
  }
}

function cacheKey(path: string, params: Params): string {
  const query = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return `${path}?${query}`;
}
