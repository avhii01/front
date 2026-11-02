import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from './api';

export interface PollingResult<T> {
  data: T | null;
  error: string | null;
  /** True until the first response (or error) for the current key. */
  loading: boolean;
  refresh: () => Promise<void>;
  /** Replace data (e.g. with a mutation response); invalidates any in-flight poll. */
  setData: (value: T) => void;
}

/**
 * Fetch a resource and optionally re-fetch it on an interval.
 * - `key === null` disables the resource entirely.
 * - Changing `key` resets the data and loads again.
 * - Late responses from superseded requests are ignored.
 * - Poll ticks are skipped while a request is still in flight.
 */
export function usePolling<T>(fetcher: () => Promise<T>, key: string | null, intervalMs: number | null): PollingResult<T> {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({
    data: null,
    error: null,
    loading: key !== null,
  });
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const requestId = useRef(0);
  const inFlight = useRef(0);

  const load = useCallback(async () => {
    if (key === null) return;
    const id = ++requestId.current;
    inFlight.current += 1;
    try {
      const data = await fetcherRef.current();
      if (id === requestId.current) setState({ data, error: null, loading: false });
    } catch (e) {
      if (id === requestId.current) setState((s) => ({ ...s, error: errorMessage(e), loading: false }));
    } finally {
      inFlight.current -= 1;
    }
  }, [key]);

  useEffect(() => {
    requestId.current += 1;
    setState({ data: null, error: null, loading: key !== null });
    void load();
  }, [key, load]);

  useEffect(() => {
    if (key === null || !intervalMs) return undefined;
    const t = setInterval(() => {
      if (inFlight.current === 0) void load();
    }, intervalMs);
    return () => clearInterval(t);
  }, [key, intervalMs, load]);

  const setData = useCallback((value: T) => {
    requestId.current += 1;
    setState({ data: value, error: null, loading: false });
  }, []);

  return { ...state, refresh: load, setData };
}

/** useState persisted in localStorage (silently falls back to memory if unavailable). */
export function useLocalStorage(key: string, initial = ''): [string, (v: string) => void] {
  const [value, setValue] = useState<string>(() => {
    try {
      return window.localStorage.getItem(key) ?? initial;
    } catch {
      return initial;
    }
  });
  const set = useCallback(
    (v: string) => {
      setValue(v);
      try {
        window.localStorage.setItem(key, v);
      } catch {
        /* storage unavailable: keep in memory */
      }
    },
    [key],
  );
  return [value, set];
}
