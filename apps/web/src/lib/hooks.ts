import { useCallback, useEffect, useRef, useState } from 'react';
import { api, isAbortError } from './api';

export interface AsyncState<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  /** Re-fetches; keeps showing the current data while loading. */
  reload: () => void;
  setData: (data: T) => void;
}

/** GETs `path` (skipped when null) and re-fetches when it changes. */
export function useApi<T>(path: string | null): AsyncState<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(path !== null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (path === null) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    api<T>(path, { signal: controller.signal })
      .then((result) => {
        setData(result);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (isAbortError(err)) return;
        setError(err);
        setLoading(false);
      });
    return () => controller.abort();
  }, [path, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload, setData };
}

/** Calls `callback` every `ms` while the tab is visible, and once when it becomes visible again. */
export function useVisiblePolling(callback: () => void, ms: number, enabled = true): void {
  const saved = useRef(callback);
  useEffect(() => {
    saved.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') saved.current();
    }, ms);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') saved.current();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [ms, enabled]);
}

/** Copies text to the clipboard and exposes a short-lived "copied" flag for inline feedback. */
export function useCopy(resetMs = 2000): { copied: boolean; failed: boolean; copy: (text: string) => void } {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = useCallback(
    (text: string) => {
      const done = (next: 'copied' | 'failed') => {
        setState(next);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setState('idle'), resetMs);
      };
      if (!navigator.clipboard) {
        done('failed');
        return;
      }
      navigator.clipboard.writeText(text).then(
        () => done('copied'),
        () => done('failed'),
      );
    },
    [resetMs],
  );

  return { copied: state === 'copied', failed: state === 'failed', copy };
}

/** Returns `value` once it has stopped changing for `ms`. */
export function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return debounced;
}
