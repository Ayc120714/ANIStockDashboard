/**
 * IST-aware market session for mobile page caches (mirrors stockdashboard/src/utils/marketSession.js).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {apiGet} from '@core/api/apiClient';

const SESSION_STORAGE_KEY = '@ani/mobile/market-session-v1';
const LIVE_STATUS_REFRESH_MS = 60_000;
const CLOSED_STATUS_REFRESH_MS = 30 * 60_000;

export const CLOSED_PAGE_CACHE_MS = 24 * 60 * 60_000;
export const LIVE_PAGE_CACHE_MAX_AGE_MS = 90_000;

const IST_TZ = 'Asia/Kolkata';

let memory = null;
let inflight = null;

export function isNseRegularSessionIstNow(date = new Date()) {
  try {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: IST_TZ,
      weekday: 'short',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
    const parts = Object.fromEntries(fmt.formatToParts(date).map(p => [p.type, p.value]));
    if (parts.weekday === 'Sat' || parts.weekday === 'Sun') return false;
    const mins = Number(parts.hour) * 60 + Number(parts.minute);
    return mins >= 9 * 60 + 15 && mins <= 15 * 60 + 30;
  } catch {
    return false;
  }
}

export function shouldPollLiveMarket(session) {
  if (session?.isLiveMarket) return true;
  if (session?.isTradingDay === false) return false;
  return isNseRegularSessionIstNow();
}

function istClockParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST_TZ,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map(p => [p.type, p.value]));
  return {
    weekday: parts.weekday,
    y: Number(parts.year),
    m: Number(parts.month),
    d: Number(parts.day),
    mins: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

function istCloseEpochMs(y, m, d) {
  const pad = n => String(n).padStart(2, '0');
  return Date.parse(`${y}-${pad(m)}-${pad(d)}T15:30:00+05:30`);
}

export function isPostMarketPageCacheStale(updatedAt, session) {
  const ts = Number(updatedAt);
  if (!ts) return true;
  if (session?.isTradingDay === false) return false;

  const nowP = istClockParts();
  if (nowP.weekday === 'Sat' || nowP.weekday === 'Sun') return false;

  const cacheP = istClockParts(new Date(ts));
  const sameIstDay = cacheP.y === nowP.y && cacheP.m === nowP.m && cacheP.d === nowP.d;
  const closeMins = 15 * 60 + 30;

  if (nowP.mins <= closeMins) return !sameIstDay;
  if (!sameIstDay) return true;
  return ts < istCloseEpochMs(nowP.y, nowP.m, nowP.d);
}

export function isPageCacheStale(updatedAt, session) {
  if (!updatedAt) return true;
  if (shouldPollLiveMarket(session)) {
    return Date.now() - Number(updatedAt) > LIVE_PAGE_CACHE_MAX_AGE_MS;
  }
  return isPostMarketPageCacheStale(updatedAt, session);
}

const parseStatus = status => {
  const orch = status?.orchestrator || {};
  const isMarketHours = Boolean(orch.is_market_hours);
  const isTradingDay = Boolean(orch.is_trading_day);
  const mode = String(orch.mode || orch.current_mode || '').toLowerCase();
  const liveSource = String(orch.live_data_source || '').toLowerCase();
  const isLiveMarket = isMarketHours && isTradingDay;
  return {
    isLiveMarket,
    isMarketHours,
    isTradingDay,
    marketPhase: orch.market_phase || status?.market_info?.market_phase || 'off_hours',
    mode: mode || 'unknown',
    liveSource,
    fetchedAt: Date.now(),
  };
};

async function loadStoredSession() {
  try {
    const raw = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.fetchedAt !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

async function persistSession(session) {
  memory = session;
  try {
    await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* ignore */
  }
}

async function fetchStatusRaw() {
  return apiGet('/system/status');
}

export async function ensureMarketSession({force = false} = {}) {
  const now = Date.now();
  if (!force && memory) {
    const maxAge = memory.isLiveMarket ? LIVE_STATUS_REFRESH_MS : CLOSED_STATUS_REFRESH_MS;
    if (now - memory.fetchedAt < maxAge) return memory;
  }
  if (!force) {
    const stored = await loadStoredSession();
    if (stored) {
      const maxAge = stored.isLiveMarket ? LIVE_STATUS_REFRESH_MS : CLOSED_STATUS_REFRESH_MS;
      if (now - stored.fetchedAt < maxAge) {
        memory = stored;
        return stored;
      }
    }
  }
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const status = await fetchStatusRaw();
      const session = parseStatus(status);
      await persistSession(session);
      return session;
    } catch {
      const istSession = isNseRegularSessionIstNow();
      const prior = memory || (await loadStoredSession());
      const fallback = prior || {
        isLiveMarket: istSession,
        isMarketHours: istSession,
        isTradingDay: istSession,
        marketPhase: istSession ? 'market_hours' : 'off_hours',
        mode: 'unknown',
        fetchedAt: now,
      };
      if (prior && istSession && !prior.isLiveMarket) {
        fallback.isLiveMarket = true;
        fallback.isMarketHours = true;
        fallback.fetchedAt = now;
      }
      memory = fallback;
      return fallback;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export function getCachedMarketSession() {
  return memory;
}

/** In-memory session when still within refresh window; avoids blocking on /system/status. */
export function getFreshCachedMarketSession() {
  const now = Date.now();
  if (!memory) return null;
  const maxAge = memory.isLiveMarket ? LIVE_STATUS_REFRESH_MS : CLOSED_STATUS_REFRESH_MS;
  if (now - memory.fetchedAt >= maxAge) return null;
  return memory;
}

export async function resolveMarketSession({force = false} = {}) {
  if (!force) {
    const fresh = getFreshCachedMarketSession();
    if (fresh) return fresh;
  }
  return ensureMarketSession({force});
}

export function getMarketPollingIntervalMs(liveMs, closedMs = 0) {
  const session = getCachedMarketSession();
  if (shouldPollLiveMarket(session)) return liveMs;
  return closedMs;
}

export function shouldSkipNetworkForClosedMarket(updatedAt, hasCache = false) {
  const session = getCachedMarketSession();
  if (shouldPollLiveMarket(session)) return false;
  if (isPageCacheStale(updatedAt, session)) return false;
  if (!hasCache) return false;
  if (!updatedAt) return true;
  return Date.now() - updatedAt < CLOSED_PAGE_CACHE_MS;
}
