export interface RequestOptions {
  /** Durata di validità (ms) della risposta in cache, al posto di quella decisa dalla policy. Ignorata senza cache. */
  ttlMs?: number;
}

export interface HttpClient {
  get<T>(path: string, params?: Record<string, string | number | boolean>, options?: RequestOptions): Promise<T>;
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    url: string,
  ) {
    super(`Richiesta fallita (${status}): ${url}`);
  }
}

export class FetchHttpClient implements HttpClient {
  constructor(private readonly baseUrl: string) {}

  async get<T>(path: string, params: Record<string, string | number | boolean> = {}): Promise<T> {
    const query = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    const url = `${this.baseUrl}${path}${query ? `?${query}` : ''}`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new HttpError(response.status, url);
    return (await response.json()) as T;
  }
}
