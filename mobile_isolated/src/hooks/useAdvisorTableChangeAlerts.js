import {useCallback, useEffect, useRef} from 'react';
import {fetchAdvisorTableSnapshots} from '@core/utils/advisorTableSnapshots';
import {
  loadAdvisorTableChangeEvents,
  processAdvisorTableSnapshots,
} from '@core/utils/advisorTableChangeAlerts';
import {
  ensureMarketSession,
  getCachedMarketSession,
  getMarketPollingIntervalMs,
  shouldPollLiveMarket,
} from '@core/utils/marketSession';

const LIVE_POLL_MS = 90_000;
const CLOSED_CHECK_MS = 5 * 60_000;

export function useAdvisorTableChangeAlerts({enabled = true} = {}) {
  const checkingRef = useRef(false);
  const timerRef = useRef(null);

  const poll = useCallback(async () => {
    if (!enabled || checkingRef.current) return [];
    checkingRef.current = true;
    try {
      await ensureMarketSession();
      if (!shouldPollLiveMarket(getCachedMarketSession())) {
        return loadAdvisorTableChangeEvents();
      }

      const snapshots = await fetchAdvisorTableSnapshots();
      const {events} = await processAdvisorTableSnapshots(snapshots);
      return events;
    } catch {
      return loadAdvisorTableChangeEvents();
    } finally {
      checkingRef.current = false;
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return undefined;

    const scheduleNext = async () => {
      await ensureMarketSession();
      const delay = getMarketPollingIntervalMs(LIVE_POLL_MS, CLOSED_CHECK_MS);
      timerRef.current = setTimeout(async () => {
        await poll();
        scheduleNext();
      }, delay);
    };

    poll().finally(() => scheduleNext());

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, poll]);

  return {pollTableAlerts: poll};
}
