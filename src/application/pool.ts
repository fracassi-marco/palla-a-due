const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Riprova un'operazione di rete con attese crescenti; l'ultimo errore viene rilanciato. */
export async function withRetry<T>(task: () => Promise<T>, retries = 2, baseDelayMs = 500): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await task();
    } catch (error) {
      if (attempt >= retries) throw error;
      await sleep(baseDelayMs * 3 ** attempt);
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
