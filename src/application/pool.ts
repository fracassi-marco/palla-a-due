const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Attesa massima accettata da un Retry-After: oltre, conviene rinunciare e ritentare alla prossima sincronizzazione. */
const MAX_RATE_LIMIT_WAIT_MS = 60_000;
const RATE_LIMIT_RETRIES = 5;

/** Con un 429 il server chiede di rallentare: rispetta Retry-After (se c'è) oppure aspetta a lungo, con più tentativi. */
function rateLimitWait(error: unknown, attempt: number): number | null {
  const { status, retryAfterMs } = error as { status?: number; retryAfterMs?: number | null };
  if (status !== 429) return null;
  return Math.min(retryAfterMs ?? 5_000 * 2 ** attempt, MAX_RATE_LIMIT_WAIT_MS);
}

/** Riprova un'operazione di rete con attese crescenti; l'ultimo errore viene rilanciato. */
export async function withRetry<T>(task: () => Promise<T>, retries = 2, baseDelayMs = 500): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await task();
    } catch (error) {
      const rateLimitDelay = rateLimitWait(error, attempt);
      const limit = rateLimitDelay === null ? retries : Math.max(retries, RATE_LIMIT_RETRIES);
      if (attempt >= limit) throw error;
      await sleep(rateLimitDelay ?? baseDelayMs * 3 ** attempt);
    }
  }
}

export interface PoolResult {
  failures: number;
  firstError: Error | null;
}

/**
 * Esegue `task` su tutti gli elementi con al massimo `concurrency` operazioni in parallelo.
 * Un elemento che fallisce non ferma gli altri: viene contato e ritentato alla prossima sincronizzazione.
 */
export async function runPool<T>(items: T[], concurrency: number, task: (item: T) => Promise<void>): Promise<PoolResult> {
  const result: PoolResult = { failures: 0, firstError: null };
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++];
      try {
        await task(item);
      } catch (error) {
        result.failures++;
        result.firstError ??= error instanceof Error ? error : new Error(String(error));
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return result;
}
