import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {alertsService} from '@core/api/services/alertsService';
import {authService} from '@core/api/services/authService';
import {STORAGE_KEYS} from '@core/storage/keys';
import {
  INBOX_SOURCES,
  applyInboxReadStateToSections,
  buildInboxSections,
  countUnreadInboxItems,
  inboxItemKey,
  isInboxItemRead,
  parseInboxReadKeys,
  serializeInboxReadKeys,
} from '@core/utils/alertInboxUtils';
import {loadAdvisorTableChangeEvents} from '@core/utils/advisorTableChangeAlerts';

const POLL_MS = 60_000;

async function loadStoredReadKeys() {
  const stored = (await AsyncStorage.getItem(STORAGE_KEYS.notificationInboxDigest)) || '';
  return parseInboxReadKeys(stored);
}

async function persistReadKeys(keys) {
  await AsyncStorage.setItem(STORAGE_KEYS.notificationInboxDigest, serializeInboxReadKeys(keys));
}

export function useNotificationInbox({enabled = true, userId = '', isSuperAdmin = false} = {}) {
  const [sections, setSections] = useState(() => buildInboxSections());
  const [readKeys, setReadKeys] = useState(() => new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [badgeCount, setBadgeCount] = useState(0);
  const readKeysRef = useRef(new Set());
  const checkingRef = useRef(false);

  const syncBadge = useCallback((allItems, keys = readKeysRef.current) => {
    setBadgeCount(countUnreadInboxItems(allItems, keys));
  }, []);

  const displaySections = useMemo(
    () => applyInboxReadStateToSections(sections, readKeys),
    [readKeys, sections],
  );

  const load = useCallback(async () => {
    if (!enabled || checkingRef.current) return;
    checkingRef.current = true;
    setLoading(true);
    setError('');
    try {
      const adminPromise = isSuperAdmin
        ? authService.fetchAdminNotifications({limit: 40}).catch(() => null)
        : Promise.resolve(null);

      const [liveRes, specialRes, priceRes, adminRes, tableRes] = await Promise.allSettled([
        alertsService.fetchLiveAdvisorAlerts({limit: 120}),
        alertsService.fetchSpecialAlerts({limit: 300, currentDayOnly: false, includeHistory: true}),
        userId ? alertsService.fetchPriceAlertTriggers({userId, limit: 200}) : Promise.resolve([]),
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

      const failures = [liveRes, specialRes, priceRes, adminRes].filter(r => r.status === 'rejected');
      if (failures.length === 4 && !tableEvents.length) {
        setError('Could not load notifications.');
      }
    } catch (e) {
      setError(String(e?.message || e || 'Could not load notifications.'));
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
      await persistReadKeys(next);
      syncBadge(sections.all, next);

      if (item.source === INBOX_SOURCES.ADMIN && item.id) {
        authService.markAdminNotificationRead(item.id).catch(() => {});
        setSections(prev => {
          const markRow = row =>
            inboxItemKey(row) === key
              ? {...row, isRead: true, raw: {...(row.raw || {}), is_read: true}}
              : row;
          const nextSections = {};
          for (const [sectionKey, rows] of Object.entries(prev)) {
            nextSections[sectionKey] = (rows || []).map(markRow);
          }
          return nextSections;
        });
      }
    },
    [sections.all, syncBadge],
  );

  const markAllRead = useCallback(async () => {
    const adminToMark = sections.all.filter(
      item => item.source === INBOX_SOURCES.ADMIN && !isInboxItemRead(item, readKeysRef.current),
    );
    const next = new Set(readKeysRef.current);
    for (const item of sections.all) {
      next.add(inboxItemKey(item));
    }
    readKeysRef.current = next;
    setReadKeys(next);
    await persistReadKeys(next);
    syncBadge(sections.all, next);

    await Promise.allSettled(
      adminToMark.map(item => authService.markAdminNotificationRead(item.id).catch(() => {})),
    );
    if (adminToMark.length) {
      setSections(prev => {
        const nextSections = {};
        for (const [sectionKey, rows] of Object.entries(prev)) {
          nextSections[sectionKey] = (rows || []).map(row =>
            row.source === INBOX_SOURCES.ADMIN ? {...row, isRead: true, raw: {...(row.raw || {}), is_read: true}} : row,
          );
        }
        return nextSections;
      });
    }
  }, [sections.all, syncBadge]);

  useEffect(() => {
    if (!enabled) return undefined;
    loadStoredReadKeys().then(keys => {
      readKeysRef.current = keys;
      setReadKeys(keys);
    });
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [enabled, load]);

  useEffect(() => {
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
