import {useCallback, useEffect, useRef, useState} from 'react';
import {AppState} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {alertsService} from '@core/api/services/alertsService';
import {signalsService} from '@core/api/services/signalsService';
import {MOBILE_ALERTS_LIMIT, MOBILE_SIGNALS_TAB_LIMIT} from '@core/utils/advisorWebParity';
import {API_TIMEOUT_MS} from '@core/config/apiTimeouts';
import {STORAGE_KEYS} from '@core/storage/keys';
import {clearPageCache} from '@core/storage/pageCache';
import {MOBILE_PAGE_CACHE_KEYS} from '@core/utils/dashboardCachePolicy';
import {extractApiRows} from '@core/utils/apiPayload';
import {isTodayInIST} from '@core/utils/alertInboxUtils';
import {
  isLiveEntryExitAlert,
  liveAlertToSignalRow,
} from '@core/utils/signalsTabPayload';
import {
  loadAdvisorTableChangeEvents,
  processAdvisorTableSnapshots,
} from '@core/utils/advisorTableChangeAlerts';
import {fetchAdvisorTableSnapshots, ADVISOR_TABLE_META} from '@core/utils/advisorTableSnapshots';
import {diffNewLiveAlerts, liveAlertsDigest} from '@core/utils/liveAlertsDigest';
import {
  ensureMarketSession,
  getCachedMarketSession,
  shouldPollLiveMarket,
} from '@core/utils/marketSession';
import {buildSignalNotificationPayload} from '@core/utils/signalNotificationCopy';
import {diffNewSignals, signalsDigest} from '@core/utils/signalsDigest';
import {
  ensureNotificationPermission,
  notifyNewSignals,
  queueInAppEntryBanner,
  queueInAppSignalBanner,
  showSystemNotification,
} from '@core/utils/signalNotifications';

const LIVE_ACTIVE_POLL_MS = 30_000;
const LIVE_BACKGROUND_POLL_MS = 60_000;
const BOOT_DELAY_MS = 3_000;

function groupTableEvents(events = []) {
  const grouped = new Map();
  for (const event of events || []) {
    const key = event?.tableKey || event?.source || 'table';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(event);
  }
  return grouped;
}

async function notifyTableChanges(newEvents = []) {
  const grouped = groupTableEvents(newEvents);
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
      `${label}: ${rows.length} new setup${countLabel}`,
      names || 'Tap notifications to review',
    );
    const navTarget = meta.screensMain
      ? {type: 'screens', screensMain: meta.screensMain}
      : meta.advisorTab
        ? {type: 'advisor', advisorTab: meta.advisorTab, trendTf: meta.trendTf}
        : null;
    if (navTarget) {
      await queueInAppEntryBanner({
        entryHint: `${label}: ${rows.length} new setup${countLabel}${names ? ` — ${names}` : ''}`,
        navTarget,
      });
    }
  }
}

function liveAlertNotificationCopy(alert) {
  const sym = String(alert?.symbol || '').trim().toUpperCase() || 'Setup';
  const type = String(alert?.alert_type || alert?.source || 'Advisor').replace(/_/g, ' ');
  const message =
    String(alert?.message || alert?.title || alert?.description || '').trim()
    || `${sym} setup alert`;
  return {title: `${sym} · ${type}`, message};
}

/**
 * Polls advisor signals, live DB alerts, and advisor table changes during market hours.
 * Fires Android system notifications + in-app Signals banner when new setups appear.
 */
export function useMarketSetupAlerts({enabled = true} = {}) {
  const [entryHint, setEntryHint] = useState('');
  const [entryNavTarget, setEntryNavTarget] = useState(null);
  const [signalsBadge, setSignalsBadge] = useState(undefined);
  const firstSignalPoll = useRef(true);
  const firstLiveAlertPoll = useRef(true);
  const firstTablePoll = useRef(true);
  const inflightRef = useRef(false);
  const timerRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  const applySignalBanner = useCallback(async fresh => {
    const payload = buildSignalNotificationPayload(fresh);
    if (!payload) return;
    setEntryHint(payload.entryHint);
    setEntryNavTarget(payload.navTarget || {type: 'signals'});
    setSignalsBadge(fresh.length > 99 ? '99+' : String(fresh.length));
    await queueInAppSignalBanner(payload);
    await notifyNewSignals(fresh, {vibrateInApp: appStateRef.current === 'active'});
  }, []);

  const pollSignals = useCallback(async () => {
    const sigRes = await signalsService
      .fetchLatestSignals({limit: MOBILE_SIGNALS_TAB_LIMIT, mobile_lite: true, timeoutMs: API_TIMEOUT_MS.advisor})
      .catch(() => null);
    if (!sigRes) return;

    const data = Array.isArray(sigRes) ? sigRes : extractApiRows(sigRes);
    const digest = signalsDigest(data);
    const prev = await AsyncStorage.getItem(STORAGE_KEYS.signalsDigest);

    if (!firstSignalPoll.current && prev && digest !== prev) {
      const fresh = diffNewSignals(prev, data);
      if (fresh.length) {
        await applySignalBanner(fresh);
      }
    }

    await AsyncStorage.setItem(STORAGE_KEYS.signalsDigest, digest);
    firstSignalPoll.current = false;
  }, [applySignalBanner]);

  const pollLiveAdvisorAlerts = useCallback(async () => {
    const rows = await alertsService
      .fetchLiveAdvisorAlerts({limit: MOBILE_ALERTS_LIMIT, timeoutMs: API_TIMEOUT_MS.advisor})
      .catch(() => null);
    if (!rows) return;

    const list = Array.isArray(rows) ? rows : extractApiRows(rows);
    const digest = liveAlertsDigest(list);
    const prev = await AsyncStorage.getItem(STORAGE_KEYS.liveAdvisorAlertsDigest);

    if (!firstLiveAlertPoll.current && prev && digest !== prev) {
      const fresh = diffNewLiveAlerts(prev, list).filter(row => {
        if (row?.is_read) return false;
        return isTodayInIST(row?.created_at || row?.alert_time || row?.updated_at);
      });
      for (const alert of fresh.slice(0, 5)) {
        const copy = liveAlertNotificationCopy(alert);
        await showSystemNotification(copy.title, copy.message);
      }
      const actionable = fresh
        .filter(isLiveEntryExitAlert)
        .map(liveAlertToSignalRow)
        .filter(row => row.symbol);
      if (actionable.length) {
        const entryReady = actionable.filter(row => String(row.status) === 'entry_ready');
        if (entryReady.length) {
          await applySignalBanner(entryReady);
        } else {
          const names = actionable
            .slice(0, 4)
            .map(row => row.symbol)
            .join(', ');
          setEntryHint(`New live signal${actionable.length > 1 ? 's' : ''}: ${names}. Tap to open.`);
          setEntryNavTarget({type: 'signals'});
          setSignalsBadge(prevBadge => prevBadge || (actionable.length > 99 ? '99+' : String(actionable.length)));
          await queueInAppEntryBanner({
            entryHint: `New live signal${actionable.length > 1 ? 's' : ''}: ${names}. Tap to open.`,
            navTarget: {type: 'signals'},
          });
        }
        await clearPageCache(MOBILE_PAGE_CACHE_KEYS.advisorSignals);
      } else if (fresh.length) {
        setSignalsBadge(prevBadge => prevBadge || (fresh.length > 99 ? '99+' : String(fresh.length)));
      }
    }

    await AsyncStorage.setItem(STORAGE_KEYS.liveAdvisorAlertsDigest, digest);
    firstLiveAlertPoll.current = false;
  }, [applySignalBanner]);

  const pollTableChanges = useCallback(async () => {
    const snapshots = await fetchAdvisorTableSnapshots().catch(() => null);
    if (!snapshots) return;

    const {newEvents, bootstrapped} = await processAdvisorTableSnapshots(snapshots);
    if (!firstTablePoll.current && !bootstrapped && newEvents.length) {
      await notifyTableChanges(newEvents);
    }
    firstTablePoll.current = false;
  }, []);

  const tick = useCallback(async () => {
    if (!enabled || inflightRef.current) return;
    inflightRef.current = true;
    try {
      await ensureNotificationPermission();
      await ensureMarketSession();
      if (!shouldPollLiveMarket(getCachedMarketSession())) {
        return;
      }

      await Promise.allSettled([pollSignals(), pollLiveAdvisorAlerts(), pollTableChanges()]);
    } catch {
      /* best-effort */
    } finally {
      inflightRef.current = false;
    }
  }, [enabled, pollLiveAdvisorAlerts, pollSignals, pollTableChanges]);

  const scheduleNext = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!enabled) return;

    await ensureMarketSession().catch(() => {});
    const live = shouldPollLiveMarket(getCachedMarketSession());
    const delay = !live
      ? 0
      : appStateRef.current === 'active'
        ? LIVE_ACTIVE_POLL_MS
        : LIVE_BACKGROUND_POLL_MS;

    if (delay <= 0) return;

    timerRef.current = setTimeout(async () => {
      await tick();
      scheduleNext();
    }, delay);
  }, [enabled, tick]);

  const refreshSetupAlerts = useCallback(async () => {
    await tick();
    await loadAdvisorTableChangeEvents();
  }, [tick]);

  useEffect(() => {
    if (!enabled) return undefined;

    const boot = setTimeout(() => {
      tick().finally(() => scheduleNext());
    }, BOOT_DELAY_MS);

    const sub = AppState.addEventListener('change', nextState => {
      appStateRef.current = nextState;
      if (nextState === 'active') {
        tick().finally(() => scheduleNext());
      } else {
        scheduleNext();
      }
    });

    return () => {
      clearTimeout(boot);
      if (timerRef.current) clearTimeout(timerRef.current);
      sub.remove();
    };
  }, [enabled, scheduleNext, tick]);

  const clearEntryHint = useCallback(() => {
    setEntryHint('');
    setEntryNavTarget(null);
  }, []);
  const clearSignalsBadge = useCallback(() => setSignalsBadge(undefined), []);

  return {
    entryHint,
    entryNavTarget,
    signalsBadge,
    clearEntryHint,
    clearSignalsBadge,
    refreshSetupAlerts,
  };
}
