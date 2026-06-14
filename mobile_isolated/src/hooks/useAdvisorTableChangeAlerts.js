import {useCallback, useEffect, useRef} from 'react';
import {fetchAdvisorTableSnapshots} from '@core/utils/advisorTableSnapshots';
import {
  loadAdvisorTableChangeEvents,
  processAdvisorTableSnapshots,
} from '@core/utils/advisorTableChangeAlerts';
import {ADVISOR_TABLE_META} from '@core/utils/advisorTableSnapshots';
import {showSystemNotification} from '@core/utils/signalNotifications';
import {
  ensureMarketSession,
  getCachedMarketSession,
  getMarketPollingIntervalMs,
  shouldPollLiveMarket,
} from '@core/utils/marketSession';

const LIVE_POLL_MS = 90_000;
const CLOSED_CHECK_MS = 5 * 60_000;

function groupEventsByTable(events = []) {
  const grouped = new Map();
  for (const event of events || []) {
    const key = event?.tableKey || event?.source || 'table';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(event);
  }
  return grouped;
}

async function notifyTableChanges(newEvents = []) {
  const grouped = groupEventsByTable(newEvents);
  for (const [tableKey, rows] of grouped.entries()) {
    if (!rows.length) continue;
    const meta = ADVISOR_TABLE_META[tableKey] || {};
    const names = rows
      .slice(0, 4)
      .map(r => r.symbol)
      .filter(Boolean)
      .join(', ');
    const label = meta.label || tableKey;
    const countLabel = rows.length > 1 ? 's' : '';
    await showSystemNotification(
      `${label}: ${rows.length} new stock${countLabel}`,
      names || 'Tap notifications to review',
    );
  }
}

export function useAdvisorTableChangeAlerts({enabled = true} = {}) {
  const checkingRef = useRef(false);
  const firstPollRef = useRef(true);
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
      const {events, newEvents, bootstrapped} = await processAdvisorTableSnapshots(snapshots);
      if (!firstPollRef.current && !bootstrapped && newEvents.length) {
        await notifyTableChanges(newEvents);
      }
      firstPollRef.current = false;
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
