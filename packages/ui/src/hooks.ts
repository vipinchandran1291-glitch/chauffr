import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from './api.ts';

/**
 * Loads data and optionally refreshes it on an interval while the tab is visible.
 * Polling stands in for push updates until we add web push / websockets.
 */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[], pollMs?: number) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState('');

  const reload = useCallback(() => load().then((d) => (setData(d), setError('')), (e) => setError(errorMessage(e))), deps);

  useEffect(() => {
    reload();
    if (!pollMs) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') reload();
    }, pollMs);
    return () => clearInterval(timer);
  }, [reload, pollMs]);

  return { data, error, reload };
}

/** Wraps an async action with busy and error state. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = useCallback(async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, error, run };
}
