import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { recordPageView } from '../api/analytics';
import { ensureMarketSession } from '../utils/marketSession';

const DEDUPE_MS_LIVE = 30_000;
const DEDUPE_MS_CLOSED = 6 * 60 * 60_000;

/**
 * Fire a page-view event on route changes (once per path per browser tab per 30s).
 */
export function usePageVisitTracker() {
  const { pathname } = useLocation();
  const lastRef = useRef({ path: '', at: 0 });

  useEffect(() => {
    let cancelled = false;
    const path = pathname || '/';

    (async () => {
      const session = await ensureMarketSession();
      if (cancelled) return;
      const dedupeMs = session.isLiveMarket ? DEDUPE_MS_LIVE : DEDUPE_MS_CLOSED;
      const now = Date.now();
      const prev = lastRef.current;
      if (prev.path === path && now - prev.at < dedupeMs) {
        return;
      }
      lastRef.current = { path, at: now };

      try {
        const key = `pv:${path}`;
        const stored = sessionStorage.getItem(key);
        if (stored && now - Number(stored) < dedupeMs) {
          return;
        }
        sessionStorage.setItem(key, String(now));
      } catch (_) {
        // sessionStorage unavailable
      }

      recordPageView(path);
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname]);
}

export default usePageVisitTracker;
