import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchAlerts, fetchSpecialAlerts, markAlertRead } from '../api/advisor';
import { fetchAdminNotifications, markAdminNotificationRead } from '../api/auth';
import { fetchPriceAlertTriggers } from '../api/priceAlerts';
import {
  INBOX_SOURCES,
  filterUnreadInboxSections,
  buildInboxSections,
  countUnreadInboxItems,
  inboxItemKey,
  isAdvisorDbAlertItem,
  isInboxItemRead,
  mergeInboxReadKeys,
  parseInboxReadKeys,
  serializeInboxReadKeys,
} from '../utils/alertInboxUtils';
import { ensureMarketSession, getCachedMarketSession, shouldPollLiveMarket } from '../utils/marketSession';

const LIVE_POLL_MS = 30_000;
const CLOSED_POLL_MS = 60_000;

function readKeysStorageKey(userId) {
  return `notification_inbox_read_v1_${userId || 'anon'}`;
}

function loadStoredReadKeys(userId) {
  try {
    return parseInboxReadKeys(localStorage.getItem(readKeysStorageKey(userId)) || '');
  } catch (_) {
    return new Set();
  }
}

function persistReadKeys(userId, keys) {
  try {
    localStorage.setItem(readKeysStorageKey(userId), serializeInboxReadKeys(keys));
  } catch (_) {
    /* ignore */
  }
}

function patchSectionsReadState(sections, { key, source } = {}) {
  const nextSections = {};
  for (const [sectionKey, rows] of Object.entries(sections)) {
    nextSections[sectionKey] = (rows || []).map((row) => {
      const matchesKey = key ? inboxItemKey(row) === key : false;
      const matchesSource = source ? row.source === source : false;
      if (!matchesKey && !matchesSource) return row;
      return {
        ...row,
        isRead: true,
        raw: { ...(row.raw || {}), is_read: true },
      };
    });
  }
  return nextSections;
}

export function useNotificationInbox({ enabled = true, userId = '', isSuperAdmin = false } = {}) {
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
    () => filterUnreadInboxSections(sections, readKeys),
    [readKeys, sections],
  );

  const load = useCallback(async () => {
    if (!enabled || checkingRef.current) return;
    checkingRef.current = true;
    setLoading(true);
    setError('');
    try {
      const adminPromise = isSuperAdmin
        ? fetchAdminNotifications({ limit: 40 }).catch(() => null)
        : Promise.resolve(null);

      const [liveRes, specialRes, priceRes, adminRes] = await Promise.allSettled([
        fetchAlerts({ limit: 120 }),
        fetchSpecialAlerts({ limit: 300, currentDayOnly: false, includeHistory: true }),
        userId ? fetchPriceAlertTriggers({ userId, limit: 200 }) : Promise.resolve([]),
        adminPromise,
      ]);

      const live = liveRes.status === 'fulfilled' ? liveRes.value : [];
      const special = specialRes.status === 'fulfilled' ? specialRes.value : [];
      const price = priceRes.status === 'fulfilled' ? priceRes.value : [];
      const adminPayload = adminRes.status === 'fulfilled' ? adminRes.value : null;
      const admin = Array.isArray(adminPayload?.data) ? adminPayload.data : [];

      const nextSections = buildInboxSections({ live, special, price, admin, tableEvents: [] });
      setSections(nextSections);
      syncBadge(nextSections.all);

      const failures = [liveRes, specialRes, priceRes, adminRes].filter((r) => r.status === 'rejected');
      if (failures.length === (isSuperAdmin ? 4 : 3)) {
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
    async (item) => {
      if (!item || isInboxItemRead(item, readKeysRef.current)) return;
      const key = inboxItemKey(item);
      const next = new Set(readKeysRef.current);
      next.add(key);
      readKeysRef.current = next;
      setReadKeys(next);
      persistReadKeys(userId, next);
      syncBadge(sections.all, next);

      if (isAdvisorDbAlertItem(item)) {
        markAlertRead(item.id).catch(() => {});
        setSections((prev) => patchSectionsReadState(prev, { key }));
      }

      if (item.source === INBOX_SOURCES.ADMIN && item.id) {
        markAdminNotificationRead(item.id).catch(() => {});
        setSections((prev) => patchSectionsReadState(prev, { key }));
      }
    },
    [sections.all, syncBadge, userId],
  );

  const markAllRead = useCallback(async () => {
    const advisorToMark = sections.all.filter(
      (item) => isAdvisorDbAlertItem(item) && !isInboxItemRead(item, readKeysRef.current),
    );
    const adminToMark = sections.all.filter(
      (item) => item.source === INBOX_SOURCES.ADMIN && !isInboxItemRead(item, readKeysRef.current),
    );
    const next = new Set(readKeysRef.current);
    for (const item of sections.all) {
      next.add(inboxItemKey(item));
    }
    readKeysRef.current = next;
    setReadKeys(next);
    persistReadKeys(userId, next);
    syncBadge(sections.all, next);

    await Promise.allSettled([
      ...advisorToMark.map((item) => markAlertRead(item.id).catch(() => {})),
      ...adminToMark.map((item) => markAdminNotificationRead(item.id).catch(() => {})),
    ]);

    setSections((prev) => {
      const nextSections = {};
      for (const [sectionKey, rows] of Object.entries(prev)) {
        nextSections[sectionKey] = (rows || []).map((row) => ({
          ...row,
          isRead: true,
          raw: { ...(row.raw || {}), is_read: true },
        }));
      }
      return nextSections;
    });
  }, [sections.all, syncBadge, userId]);

  useEffect(() => {
    readKeysRef.current = new Set();
    setReadKeys(new Set());
  }, [userId]);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    let timer;

    const init = async () => {
      const storedKeys = loadStoredReadKeys(userId);
      if (cancelled) return;
      const merged = mergeInboxReadKeys(storedKeys, readKeysRef.current);
      readKeysRef.current = merged;
      setReadKeys(merged);
      if (merged.size > storedKeys.size) {
        persistReadKeys(userId, merged);
      }
      await load();
    };

    const schedulePoll = async () => {
      await ensureMarketSession().catch(() => {});
      const live = shouldPollLiveMarket(getCachedMarketSession());
      return live ? LIVE_POLL_MS : CLOSED_POLL_MS;
    };

    init();
    (async () => {
      const pollMs = await schedulePoll();
      if (!cancelled) {
        timer = setInterval(load, pollMs);
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [enabled, load, userId]);

  useEffect(() => {
    syncBadge(sections.all, readKeys);
  }, [readKeys, sections.all, syncBadge]);

  const counts = useMemo(() => {
    const base = {
      all: displaySections.all.length,
      unread: countUnreadInboxItems(displaySections.all, readKeys),
    };
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
