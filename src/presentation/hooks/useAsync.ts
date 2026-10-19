import { useCallback, useEffect, useRef, useState } from 'react';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  error: Error | null;
  reload: () => void;
}

export function useAsync<T>(loader: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);
  const firstRun = useRef(true);

  useEffect(() => {
    let cancelled = false;
    const isRefresh = !firstRun.current;
    firstRun.current = false;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    loader()
      .then((result) => !cancelled && setData(result))
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
