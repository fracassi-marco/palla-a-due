import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

/**
 * Chiama `callback` ogni `intervalMs` finché `active`, solo con schermata a fuoco e app in primo piano.
 * Con `finalCall` la chiama ancora una volta quando `active` passa da vero a falso, per non perdere l'ultimo aggiornamento.
 */
export function usePolling(callback: () => void, active: boolean, intervalMs: number, finalCall = false) {
  const saved = useRef(callback);
  useEffect(() => {
    saved.current = callback;
  }, [callback]);

  const wasActive = useRef(active);
  useEffect(() => {
    if (finalCall && wasActive.current && !active) saved.current();
    wasActive.current = active;
  }, [active, finalCall]);

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
