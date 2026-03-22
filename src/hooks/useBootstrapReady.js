import { useState, useEffect } from 'react';
import { apiGet } from '../api/apiClient';

/**
 * Unblocks the UI as soon as the API responds (GET /api/system/status).
 * Deep startup (candles, snapshots) can still run for a long time — we still load DB data immediately.
 * Optionally tracks bootstrap_complete from /api/system/readiness for a non-blocking banner.
 */
export function useBootstrapReady(pollMs = 2000, maxWaitForApiMs = 60000) {
  const [apiReady, setApiReady] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [bootstrapComplete, setBootstrapComplete] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      let gotApi = false;
      const deadline = Date.now() + maxWaitForApiMs;
      while (!cancelled && Date.now() < deadline) {
        try {
          await apiGet('/system/status');
          gotApi = true;
          if (!cancelled) setApiReady(true);
          break;
        } catch (e) {
          const msg = (e && e.message) || '';
          if (/404|not found/i.test(msg)) {
            if (!cancelled) {
              setApiReady(true);
              gotApi = true;
            }
            break;
          }
        }
        await new Promise((r) => setTimeout(r, pollMs));
      }
      if (!cancelled && !gotApi) {
        setTimedOut(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pollMs, maxWaitForApiMs]);

  useEffect(() => {
    if (!apiReady && !timedOut) return undefined;
    let cancelled = false;
    const id = setInterval(async () => {
      if (cancelled) return;
      try {
        const r = await apiGet('/system/readiness');
        if (r && r.bootstrap_complete) {
          setBootstrapComplete(true);
          clearInterval(id);
        }
      } catch {
        /* ignore */
      }
    }, pollMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [apiReady, timedOut, pollMs]);

  return {
    apiReady,
    /** True after /api/system/readiness reports bootstrap_complete (background jobs done). */
    bootstrapComplete,
    /** True if we could not reach /system/status within maxWaitForApiMs — UI still mounts to show errors/retries. */
    timedOut,
    /** Mount data-fetching pages when API is up or wait timed out. */
    showData: apiReady || timedOut,
    /** @deprecated use bootstrapComplete */
    ready: bootstrapComplete,
  };
}
