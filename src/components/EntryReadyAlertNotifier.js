import { useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { fetchLiveSetupsPayload } from '../utils/liveSetupsPayload';
import {
  detectNewEntryReadySetups,
  notifyEntryReadyBrowser,
} from '../utils/entryReadySetupAlerts';
import { ensureMarketSession, getCachedMarketSession, shouldPollLiveMarket } from '../utils/marketSession';

/**
 * Polls for new entry-ready setups and fires browser notifications when the user
 * is on a page other than /alerts (LiveSetupsPage handles on-page snackbars).
 */
function EntryReadyAlertNotifier() {
  const location = useLocation();
  const onAlertsPage = String(location.pathname || '').startsWith('/alerts');
  const firstPoll = useRef(true);
  const inflight = useRef(false);

  const poll = useCallback(async () => {
    if (onAlertsPage || inflight.current) return;
    inflight.current = true;
    try {
      const rows = await fetchLiveSetupsPayload();
      const { fresh } = detectNewEntryReadySetups(rows, { bootstrap: firstPoll.current });
      firstPoll.current = false;
      if (fresh.length) {
        notifyEntryReadyBrowser(fresh);
      }
    } catch (_) {
      /* best-effort */
    } finally {
      inflight.current = false;
    }
  }, [onAlertsPage]);

  useEffect(() => {
    if (onAlertsPage) return undefined;

    let timer;
    let cancelled = false;

    const schedule = async () => {
      await ensureMarketSession().catch(() => {});
      if (cancelled) return;
      const pollMs = shouldPollLiveMarket(getCachedMarketSession()) ? 30_000 : 120_000;
      timer = setInterval(() => {
        if (!cancelled) poll();
      }, pollMs);
    };

    const boot = setTimeout(() => {
      poll().finally(schedule);
    }, 4_000);

    return () => {
      cancelled = true;
      clearTimeout(boot);
      if (timer) clearInterval(timer);
    };
  }, [onAlertsPage, poll]);

  return null;
}

export default EntryReadyAlertNotifier;
