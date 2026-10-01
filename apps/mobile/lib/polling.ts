import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';

export const POLL_MS = 10_000;

/** Runs `fn` immediately and then every `ms` while the screen is focused (and `enabled`). */
export function useFocusPolling(fn: () => void | Promise<void>, enabled = true, ms = POLL_MS) {
  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      void fn();
      const timer = setInterval(() => void fn(), ms);
      return () => clearInterval(timer);
    }, [fn, enabled, ms]),
  );
}
