import { useCallback, useEffect, useRef, useState } from 'react';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  error: Error | null;
  reload: () => void;
}

/** Ultimo risultato per `cacheKey`: rimontando una schermata (es. cambiando campionato) si parte dai dati già visti. */
const results = new Map<string, unknown>();

/**
 * Con `cacheKey` il risultato resta in memoria: al rimontaggio viene mostrato subito e riletto in background,
 * invece di far comparire il caricamento. La chiave deve distinguere campionato e parametri della lettura.
 */
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[] = [], cacheKey?: string): AsyncState<T> {
  const cached = cacheKey !== undefined ? (results.get(cacheKey) as T | undefined) : undefined;
  const [data, setData] = useState<T | null>(cached ?? null);
  const [loading, setLoading] = useState(cached === undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);
  const firstRun = useRef(true);

  useEffect(() => {
    let cancelled = false;
    const isRefresh = !firstRun.current;
    firstRun.current = false;
    if (isRefresh) setRefreshing(true);

    loader()
      .then((result) => {
        if (cancelled) return;
        if (cacheKey !== undefined) results.set(cacheKey, result);
        setData(result);
        setError(null);
      })
      .catch((e: Error) => !cancelled && setError(e))
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
        setRefreshing(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, refreshing, error, reload };
}
