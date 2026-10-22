type Params = Record<string, string | number | boolean>;

export interface HttpClient {
  get<T>(path: string, params?: Params): Promise<T>;
  /** Corpo della risposta come testo (pagine HTML). */
  getText(path: string, params?: Params): Promise<string>;
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    url: string,
    /** Attesa richiesta dal server (intestazione Retry-After), quando c'è. */
    readonly retryAfterMs: number | null = null,
  ) {
    super(`Richiesta fallita (${status}): ${url}`);
  }
}

/** In sviluppo ogni chiamata HTTP finisce nell'output di Expo: stato, durata e, se presente, Retry-After. */
function logRequest(url: string, status: number | string, startedAt: number, retryAfter: string | null = null) {
  if (!__DEV__) return;
  const wait = retryAfter ? ` retry-after=${retryAfter}s` : '';
  console.log(`[HTTP] ${status} ${Date.now() - startedAt}ms GET ${url}${wait}`);
}

export class FetchHttpClient implements HttpClient {
  /**
   * I percorsi che iniziano con `http` sono URL assoluti e ignorano `baseUrl`.
   * `headers` si aggiungono a ogni richiesta (e prevalgono su `Accept`): alcune fonti rifiutano i client senza intestazioni da browser.
   */
  constructor(
    private readonly baseUrl = '',
    private readonly headers: Record<string, string> = {},
  ) {}

  async get<T>(path: string, params: Params = {}): Promise<T> {
    return (await this.request(path, params, 'application/json')).json() as Promise<T>;
  }

  async getText(path: string, params: Params = {}): Promise<string> {
    return (await this.request(path, params, 'text/html')).text();
  }

  private async request(path: string, params: Params, accept: string): Promise<Response> {
    const query = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    const base = path.startsWith('http') ? '' : this.baseUrl;
    const url = `${base}${path}${query ? `?${query}` : ''}`;
    const startedAt = Date.now();
    let response: Response;
    try {
      response = await fetch(url, { headers: { Accept: accept, ...this.headers } });
    } catch (error) {
      logRequest(url, 'ERRORE DI RETE', startedAt);
      throw error;
    }
    logRequest(url, response.status, startedAt, response.headers.get('retry-after'));
    if (!response.ok) {
      const seconds = Number(response.headers.get('retry-after'));
      throw new HttpError(response.status, url, Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null);
    }
    return response;
  }
}
