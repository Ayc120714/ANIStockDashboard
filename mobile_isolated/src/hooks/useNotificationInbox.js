import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {alertsService} from '@core/api/services/alertsService';
import {authService} from '@core/api/services/authService';
import {STORAGE_KEYS, notificationInboxReadKeys} from '@core/storage/keys';
import {
  INBOX_SOURCES,
  filterUnreadInboxSections,
  buildInboxSections,
  countUnreadInboxItems,
  inboxItemKey,
  isAdvisorDbAlertItem,
  isInboxItemRead,
  isTableChangeInboxItem,
  mergeInboxReadKeys,
  parseInboxReadKeys,
  serializeInboxReadKeys,
} from '@core/utils/alertInboxUtils';
import {
  loadAdvisorTableChangeEvents,
  markAllTableChangeEventsRead,
  markTableChangeEventRead,
} from '@core/utils/advisorTableChangeAlerts';

import {MOBILE_ALERTS_LIMIT} from '@core/utils/advisorWebParity';

import { ensureMarketSession, getCachedMarketSession, shouldPollLiveMarket } from '@core/utils/marketSession';

const LIVE_POLL_MS = 30_000;
const CLOSED_POLL_MS = 60_000;

async function loadCachedInboxSections() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.notificationInboxSections);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.sections || typeof parsed.sections !== 'object') return null;
    return parsed.sections;
  } catch {
    return null;
  }
}

async function saveCachedInboxSections(sections) {
  try {
    await AsyncStorage.setItem(
      STORAGE_KEYS.notificationInboxSections,
      JSON.stringify({sections, updatedAt: Date.now()}),
    );
  } catch {
    /* ignore quota */
  }
}

async function loadStoredReadKeys(userId) {
  const scopedKey = notificationInboxReadKeys(userId);
  let stored = (await AsyncStorage.getItem(scopedKey)) || '';
  if (!stored) {
    const legacy = (await AsyncStorage.getItem(STORAGE_KEYS.notificationInboxDigest)) || '';
    if (legacy) {
      stored = legacy;
      await AsyncStorage.setItem(scopedKey, legacy);
    }
  }
  return parseInboxReadKeys(stored);
}

async function persistReadKeys(userId, keys) {
  await AsyncStorage.setItem(notificationInboxReadKeys(userId), serializeInboxReadKeys(keys));
}

function patchSectionsReadState(sections, {key, source} = {}) {
  const nextSections = {};
  for (const [sectionKey, rows] of Object.entries(sections)) {
    nextSections[sectionKey] = (rows || []).map(row => {
      const matchesKey = key ? inboxItemKey(row) === key : false;
      const matchesSource = source ? row.source === source : false;
      if (!matchesKey && !matchesSource) return row;
      return {
        ...row,
        isRead: true,
        raw: {...(row.raw || {}), is_read: true},
      };
    });
  }
  return nextSections;
}

export function useNotificationInbox({enabled = true, userId = '', isSuperAdmin = false} = {}) {
  const [sections, setSections] = useState(() => buildInboxSections());
  const [readKeys, setReadKeys] = useState(() => new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [badgeCount, setBadgeCount] = useState(0);
  const readKeysRef = useRef(new Set());
  const checkingRef = useRef(false);
  const readKeysReadyRef = useRef(false);
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;

  const syncBadge = useCallback((allItems, keys = readKeysRef.current) => {
    setBadgeCount(countUnreadInboxItems(allItems, keys));
  }, []);

  const displaySections = useMemo(
    () => filterUnreadInboxSections(sections, readKeys),
    [readKeys, sections],
  );

  const load = useCallback(async ({background = false} = {}) => {
    if (!enabled) return;
    if (checkingRef.current) {
      if (!background) return;
      return;
    }
    checkingRef.current = true;
    const hasCachedRows = sectionsRef.current.all?.length > 0;
    if (!background || !hasCachedRows) {
      setLoading(true);
    }
    setError('');
    try {
      const adminPromise = isSuperAdmin
        ? authService.fetchAdminNotifications({limit: 40}).catch(() => null)
        : Promise.resolve(null);

      const lightFetch = background && hasCachedRows;
      const [liveRes, specialRes, priceRes, adminRes, tableRes] = await Promise.allSettled([
        alertsService.fetchLiveAdvisorAlerts({limit: MOBILE_ALERTS_LIMIT}),
        alertsService.fetchSpecialAlerts({
          limit: lightFetch ? 80 : 200,
          currentDayOnly: lightFetch,
          includeHistory: !lightFetch,
        }),
        userId ? alertsService.fetchPriceAlertTriggers({userId, limit: lightFetch ? 80 : 200}) : Promise.resolve([]),
        adminPromise,
        loadAdvisorTableChangeEvents(),
      ]);

      const live = liveRes.status === 'fulfilled' ? liveRes.value : [];
      const special = specialRes.status === 'fulfilled' ? specialRes.value : [];
      const price = priceRes.status === 'fulfilled' ? priceRes.value : [];
      const adminPayload = adminRes.status === 'fulfilled' ? adminRes.value : null;
      const admin = Array.isArray(adminPayload?.data) ? adminPayload.data : [];
      const tableEvents = tableRes.status === 'fulfilled' ? tableRes.value : await loadAdvisorTableChangeEvents();

      const nextSections = buildInboxSections({live, special, price, admin, tableEvents});
      setSections(nextSections);
      syncBadge(nextSections.all);
      await saveCachedInboxSections(nextSections);

      const failures = [liveRes, specialRes, priceRes, adminRes].filter(r => r.status === 'rejected');
      if (!background && failures.length === 4 && !tableEvents.length) {
        setError('Could not load notifications.');
      }
    } catch (e) {
      if (!background) {
        setError(String(e?.message || e || 'Could not load notifications.'));
      }
    } finally {
      setLoading(false);
      checkingRef.current = false;
    }
  }, [enabled, isSuperAdmin, syncBadge, userId]);

  const markItemRead = useCallback(
    async item => {
      if (!item || isInboxItemRead(item, readKeysRef.current)) return;
      const key = inboxItemKey(item);
      const next = new Set(readKeysRef.current);
      next.add(key);
      readKeysRef.current = next;
      setReadKeys(next);
      await persistReadKeys(userId, next);
      syncBadge(sections.all, next);

      if (isAdvisorDbAlertItem(item)) {
        alertsService.markAlertRead(item.id).catch(() => {});
        setSections(prev => patchSectionsReadState(prev, {key}));
      }

      if (item.source === INBOX_SOURCES.ADMIN && item.id) {
        authService.markAdminNotificationRead(item.id).catch(() => {});
        setSections(prev => patchSectionsReadState(prev, {key}));
      }

      if (isTableChangeInboxItem(item)) {
        await markTableChangeEventRead(item.id);
        setSections(prev => patchSectionsReadState(prev, {key}));
      }
    },
    [sections.all, syncBadge, userId],
  );

  const markAllRead = useCallback(async () => {
    const advisorToMark = sections.all.filter(
      item => isAdvisorDbAlertItem(item) && !isInboxItemRead(item, readKeysRef.current),
    );
    const adminToMark = sections.all.filter(
      item => item.source === INBOX_SOURCES.ADMIN && !isInboxItemRead(item, readKeysRef.current),
    );
    const next = new Set(readKeysRef.current);
    for (const item of sections.all) {
      next.add(inboxItemKey(item));
    }
    readKeysRef.current = next;
    setReadKeys(next);
    await persistReadKeys(userId, next);
    syncBadge(sections.all, next);

    await Promise.allSettled([
      ...advisorToMark.map(item => alertsService.markAlertRead(item.id).catch(() => {})),
      ...adminToMark.map(item => authService.markAdminNotificationRead(item.id).catch(() => {})),
      markAllTableChangeEventsRead(),
    ]);

    setSections(prev => {
      const nextSections = {};
      for (const [sectionKey, rows] of Object.entries(prev)) {
        nextSections[sectionKey] = (rows || []).map(row => ({
          ...row,
          isRead: true,
          raw: {...(row.raw || {}), is_read: true},
        }));
      }
      return nextSections;
    });
  }, [sections.all, syncBadge, userId]);

  useEffect(() => {
    readKeysRef.current = new Set();
    setReadKeys(new Set());
    readKeysReadyRef.current = false;
  }, [userId]);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;

    const init = async () => {
      const storedKeys = await loadStoredReadKeys(userId);
      if (cancelled) return;
      const merged = mergeInboxReadKeys(storedKeys, readKeysRef.current);
      readKeysRef.current = merged;
      setReadKeys(merged);
      readKeysReadyRef.current = true;
      if (merged.size > storedKeys.size) {
        await persistReadKeys(userId, merged);
      }
      const cachedSections = await loadCachedInboxSections();
      if (cancelled) return;
      if (cachedSections?.all?.length) {
        setSections(cachedSections);
        syncBadge(cachedSections.all, merged);
      }
      await load({background: Boolean(cachedSections?.all?.length)});
    };

    init();
    let timer;
    (async () => {
      await ensureMarketSession().catch(() => {});
      const pollMs = shouldPollLiveMarket(getCachedMarketSession()) ? LIVE_POLL_MS : CLOSED_POLL_MS;
      if (!cancelled) {
        timer = setInterval(load, pollMs);
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [enabled, load, syncBadge, userId]);

  useEffect(() => {
    if (!readKeysReadyRef.current) return;
    syncBadge(sections.all, readKeys);
  }, [readKeys, sections.all, syncBadge]);

  const counts = useMemo(() => {
    const base = {all: displaySections.all.length, unread: countUnreadInboxItems(displaySections.all, readKeys)};
    for (const source of Object.values(INBOX_SOURCES)) {
      base[source] = displaySections[source]?.length || 0;
    }
    return base;
  }, [displaySections, readKeys]);

  return {
    sections: displaySections,
    counts,
    loading,
    error,
    badgeCount,
    load,
    markItemRead,
    markAllRead,
  };
}
