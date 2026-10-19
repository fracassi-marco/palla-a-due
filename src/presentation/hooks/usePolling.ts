import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

/** Chiama `callback` ogni `intervalMs` finché `active`, solo con schermata a fuoco e app in primo piano. */
export function usePolling(callback: () => void, active: boolean, intervalMs: number) {
  const saved = useRef(callback);
  useEffect(() => {
    saved.current = callback;
  }, [callback]);

  useFocusEffect(
    useCallback(() => {
      if (!active) return;
      let timer: ReturnType<typeof setInterval> | null = null;
      const start = () => {
        if (!timer) timer = setInterval(() => saved.current(), intervalMs);
      };
      const stop = () => {
        if (timer) clearInterval(timer);
        timer = null;
      };
      if (AppState.currentState === 'active') start();
      const sub = AppState.addEventListener('change', (state) => {
        if (state === 'active') {
          saved.current();
          start();
        } else {
          stop();
        }
      });
      return () => {
        stop();
        sub.remove();
      };
    }, [active, intervalMs]),
  );
}
