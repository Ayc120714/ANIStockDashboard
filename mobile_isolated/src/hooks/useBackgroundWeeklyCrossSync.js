import {useEffect, useRef} from 'react';
import {alertsService} from '@core/api/services/alertsService';

const SYNC_INTERVAL_MS = 10 * 60 * 1000;

/** Keeps weekly level-cross alerts synced in the background (no UI). */
export function useBackgroundWeeklyCrossSync(enabled = true) {
  const syncingRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let cancelled = false;
    let intervalId;

    const run = async () => {
      if (cancelled || syncingRef.current) {
        return;
      }
      syncingRef.current = true;
      try {
        await alertsService.syncLatestEodWeeklyCrossAlerts({limitSymbols: 3000, maxStaleDays: 14});
      } catch (_) {
        // Non-blocking background sync.
      } finally {
        syncingRef.current = false;
      }
    };

    void run();
    intervalId = setInterval(() => {
      void run();
    }, SYNC_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [enabled]);
}

export default useBackgroundWeeklyCrossSync;
