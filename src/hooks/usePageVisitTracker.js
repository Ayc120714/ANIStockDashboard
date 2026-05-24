import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { recordPageView } from '../api/analytics';

const DEDUPE_MS = 30_000;

/**
 * Fire a page-view event on route changes (once per path per browser tab per 30s).
 */
export function usePageVisitTracker() {
  const { pathname } = useLocation();
  const lastRef = useRef({ path: '', at: 0 });

  useEffect(() => {
    const path = pathname || '/';
    const now = Date.now();
    const prev = lastRef.current;
    if (prev.path === path && now - prev.at < DEDUPE_MS) {
      return;
    }
    lastRef.current = { path, at: now };

    try {
      const key = `pv:${path}`;
      const stored = sessionStorage.getItem(key);
      if (stored && now - Number(stored) < DEDUPE_MS) {
        return;
      }
      sessionStorage.setItem(key, String(now));
    } catch (_) {
      // sessionStorage unavailable
    }

    recordPageView(path);
  }, [pathname]);
}

export default usePageVisitTracker;
