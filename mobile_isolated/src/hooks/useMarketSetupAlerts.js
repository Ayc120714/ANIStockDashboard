import {useCallback, useEffect, useRef, useState} from 'react';
import {AppState} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {alertsService} from '@core/api/services/alertsService';
import {signalsService} from '@core/api/services/signalsService';
import {MOBILE_SIGNALS_TAB_LIMIT} from '@core/utils/advisorWebParity';
import {API_TIMEOUT_MS} from '@core/config/apiTimeouts';
import {STORAGE_KEYS} from '@core/storage/keys';
import {clearPageCache} from '@core/storage/pageCache';
import {MOBILE_PAGE_CACHE_KEYS} from '@core/utils/dashboardCachePolicy';
import {extractApiRows} from '@core/utils/apiPayload';
import {isDemoAlert} from '@core/utils/alertInboxUtils';
import {
  loadAdvisorTableChangeEvents,
  processAdvisorTableSnapshots,
} from '@core/utils/advisorTableChangeAlerts';
import {fetchAdvisorTableSnapshots} from '@core/utils/advisorTableSnapshots';
import {freshLiveAlertsToNotify, liveAlertsDigest} from '@core/utils/liveAlertsDigest';
import {
  ensureMarketSession,
  getCachedMarketSession,
  shouldPollLiveMarket,
} from '@core/utils/marketSession';
import {buildLiveAlertNotificationPayload} from '@core/utils/signalNotificationCopy';
import {signalsDigest} from '@core/utils/signalsDigest';
import {
  ensureNotificationPermission,
  notifyNewSignals,
  queueInAppEntryBanner,
} from '@core/utils/signalNotifications';

const LIVE_ACTIVE_POLL_MS = 30_000;
const LIVE_BACKGROUND_POLL_MS = 60_000;
const BOOT_DELAY_MS = 3_000;

/**
 * Polls ML setup alerts during market hours.
 * Vibration + system notification fire only for ML score >= 0.70.
 */
export function useMarketSetupAlerts({enabled = true} = {}) {
  const [entryHint, setEntryHint] = useState('');
  const [entryNavTarget, setEntryNavTarget] = useState(null);
  const [signalsBadge, setSignalsBadge] = useState(undefined);
  const inflightRef = useRef(false);
  const timerRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  const applyLiveAlertBanner = useCallback(async fresh => {
    const payload = buildLiveAlertNotificationPayload(fresh);
    if (!payload) return;
    setEntryHint(payload.entryHint);
    setEntryNavTarget(payload.navTarget || {type: 'alerts'});
    setSignalsBadge(fresh.length > 99 ? '99+' : String(fresh.length));
    await queueInAppEntryBanner({
      entryHint: payload.entryHint,
      navTarget: payload.navTarget || {type: 'alerts'},
    });
    await notifyNewSignals(fresh, {vibrateInApp: true});
  }, []);

  const pollSignals = useCallback(async () => {
    const sigRes = await signalsService
      .fetchLatestSignals({limit: MOBILE_SIGNALS_TAB_LIMIT, mobile_lite: true, timeoutMs: API_TIMEOUT_MS.advisor})
      .catch(() => null);
    if (!sigRes) return;

    const data = Array.isArray(sigRes) ? sigRes : extractApiRows(sigRes);
    const digest = signalsDigest(data);
    await AsyncStorage.setItem(STORAGE_KEYS.signalsDigest, digest);
  }, []);

  const pollLiveAdvisorAlerts = useCallback(async () => {
    const rows = await alertsService
      .fetchLiveAdvisorAlerts({source: 'ml_setup', limit: 80, timeoutMs: API_TIMEOUT_MS.advisor})
      .catch(() => null);
    if (!rows) return;

    const list = (Array.isArray(rows) ? rows : extractApiRows(rows)).filter(row => !isDemoAlert(row));
    const digest = liveAlertsDigest(list);
    const prev = await AsyncStorage.getItem(STORAGE_KEYS.liveAdvisorAlertsDigest);
    const fresh = freshLiveAlertsToNotify(prev, list);
    if (fresh.length) {
      await applyLiveAlertBanner(fresh);
      await clearPageCache(MOBILE_PAGE_CACHE_KEYS.advisorSignals);
    }

    await AsyncStorage.setItem(STORAGE_KEYS.liveAdvisorAlertsDigest, digest);
  }, [applyLiveAlertBanner]);

  const pollTableChanges = useCallback(async () => {
    const snapshots = await fetchAdvisorTableSnapshots().catch(() => null);
    if (!snapshots) return;

    await processAdvisorTableSnapshots(snapshots);
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
