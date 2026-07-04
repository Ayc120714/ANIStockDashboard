/**
 * Shared market-hours state for the SPA.
 * When the market is closed, GET caching and page loaders use long-lived cache
 * so tab switches do not refetch the same DB-backed data.
 */

const SESSION_STORAGE_KEY = 'market_session_v1';
const LIVE_STATUS_REFRESH_MS = 60_000;
const CLOSED_STATUS_REFRESH_MS = 30 * 60_000;

/** In-memory GET cache TTL while orchestrator is in websocket mode. */
export const LIVE_GET_CACHE_MS = (() => {
  const raw = process.env.REACT_APP_API_GET_CACHE_MS;
  if (raw === '0' || raw === '') return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, 120_000) : 8_000;
})();

/** GET cache TTL when market is not live (same data until next session). */
export const CLOSED_GET_CACHE_MS = 24 * 60 * 60_000;

/** Page sessionStorage cache considered fresh for this long when market is closed. */
export const CLOSED_PAGE_CACHE_MS = 24 * 60 * 60_000;

/** During NSE session, page cache older than this is treated as stale (Overview / screens). */
export const LIVE_PAGE_CACHE_MAX_AGE_MS = 90_000;

const IST_TZ = 'Asia/Kolkata';

/** Client-side NSE cash session window (09:15–15:30 IST, Mon–Fri). Holidays not detected here. */
export function isNseRegularSessionIstNow(date = new Date()) {
  try {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: IST_TZ,
      weekday: 'short',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
    const parts = Object.fromEntries(
      fmt.formatToParts(date).map((p) => [p.type, p.value])
    );
    const wd = parts.weekday;
    if (wd === 'Sat' || wd === 'Sun') return false;
    const mins = Number(parts.hour) * 60 + Number(parts.minute);
    return mins >= 9 * 60 + 15 && mins <= 15 * 60 + 30;
  } catch (_) {
    return false;
  }
}

/** True when SPA should poll and avoid long-lived page cache (orchestrator or IST fallback). */
export function shouldPollLiveMarket(session) {
  if (session?.isLiveMarket) return true;
  if (session?.isTradingDay === false) return false;
  return isNseRegularSessionIstNow();
}

/** Format a Date for market status lines (always IST). */
export function formatIstTime(value, { withSeconds = true } = {}) {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleTimeString('en-IN', {
    timeZone: IST_TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: withSeconds ? '2-digit' : undefined,
    hour12: true,
  })} IST`;
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
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    weekday: parts.weekday,
    y: Number(parts.year),
    m: Number(parts.month),
    d: Number(parts.day),
    mins: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

function istCloseEpochMs(y, m, d) {
  const pad = (n) => String(n).padStart(2, '0');
  return Date.parse(`${y}-${pad(m)}-${pad(d)}T15:30:00+05:30`);
}

/** NSE cash close (15:30 IST) for a `YYYY-MM-DD` reference trading date. */
export function nseCloseEpochMsForDateIso(isoDate) {
  if (!isoDate || typeof isoDate !== 'string') return null;
  const [y, m, d] = isoDate.split('-').map((x) => Number(x));
  if (!y || !m || !d) return null;
  return istCloseEpochMs(y, m, d);
}

/** Walk back from `now` to the most recent Mon–Fri close (weekend fallback). */
function lastWeekdayCloseEpochMsBefore(now = new Date()) {
  let cur = new Date(now.getTime());
  for (let i = 0; i < 10; i += 1) {
    const cp = istClockParts(cur);
    if (cp.weekday !== 'Sat' && cp.weekday !== 'Sun') {
      return istCloseEpochMs(cp.y, cp.m, cp.d);
    }
    cur = new Date(cur.getTime() - 24 * 60 * 60 * 1000);
  }
  return null;
}

/** True after 15:30 IST on a weekday (holidays not detected). */
export function isAfterNseCloseIstNow(date = new Date()) {
  const p = istClockParts(date);
  if (p.weekday === 'Sat' || p.weekday === 'Sun') return false;
  return p.mins > 15 * 60 + 30;
}

/**
 * After 15:30 on a trading day, page cache must be from after today's close.
 * Pre-open: cache from a prior IST calendar day is stale.
 */
export function isPostMarketPageCacheStale(updatedAt, session) {
  const ts = Number(updatedAt);
  if (!ts) return true;

  const nowP = istClockParts();
  const isWeekend = nowP.weekday === 'Sat' || nowP.weekday === 'Sun';
  const offCalendarSession = session?.isTradingDay === false;

  // Weekend/holiday: intraday dashboard cache must not mask EOD CHG% (subsector modal refetches).
  if (offCalendarSession || isWeekend) {
    const closeMs =
      nseCloseEpochMsForDateIso(session?.referenceTradingDate)
      ?? lastWeekdayCloseEpochMsBefore();
    if (closeMs == null) return true;
    return ts < closeMs;
  }

  const cacheP = istClockParts(new Date(ts));
  const sameIstDay =
    cacheP.y === nowP.y && cacheP.m === nowP.m && cacheP.d === nowP.d;

  const openMins = 9 * 60 + 15;
  const closeMins = 15 * 60 + 30;

  // Pre-open: always refetch screen tables so EOD CHG% replaces stale intraday cache.
  if (nowP.mins < openMins) {
    return true;
  }

  if (nowP.mins <= closeMins) {
    return !sameIstDay;
  }

  if (!sameIstDay) return true;
  return ts < istCloseEpochMs(nowP.y, nowP.m, nowP.d);
}

/** Unified stale check for Overview / screen page caches. */
export function isPageCacheStale(updatedAt, session) {
  if (!updatedAt) return true;
  if (shouldPollLiveMarket(session)) {
    return Date.now() - Number(updatedAt) > LIVE_PAGE_CACHE_MAX_AGE_MS;
  }
  return isPostMarketPageCacheStale(updatedAt, session);
}

/** @deprecated Use isPageCacheStale */
export function isLivePageCacheStale(updatedAt, session) {
  return isPageCacheStale(updatedAt, session);
}

let memory = null;
let inflight = null;

const resolveApiBase = () => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api`;
  }
  return '/api';
};

const parseStatus = (status) => {
  const orch = status?.orchestrator || {};
  const isMarketHours = Boolean(orch.is_market_hours);
  const isTradingDay = Boolean(orch.is_trading_day);
  const mode = String(orch.mode || orch.current_mode || '').toLowerCase();
  const liveSource = String(orch.live_data_source || '').toLowerCase();
  /** NSE session: orchestrator + Samco API/WS feed update DB; SPA should poll. */
  const isLiveMarket = isMarketHours && isTradingDay;
  const isApiLive = isLiveMarket && (mode === 'api_polling' || liveSource === 'api');
  const isWebSocketStreaming = isLiveMarket && mode === 'websocket' && liveSource !== 'api';
  return {
    isLiveMarket,
    isApiLive,
    isWebSocketStreaming,
    isMarketHours,
    isTradingDay,
    referenceTradingDate: status?.market_info?.reference_trading_date || null,
    marketPhase: orch.market_phase || status?.market_info?.market_phase || 'off_hours',
    mode: mode || 'unknown',
    fetchedAt: Date.now(),
  };
};

async function fetchStatusRaw() {
  const base = resolveApiBase().replace(/\/$/, '');
  const res = await fetch(`${base}/system/status`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`status ${res.status}`);
  }
  return res.json();
}

function loadStoredSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.fetchedAt !== 'number') return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

function persistSession(session) {
  memory = session;
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch (_) {
    /* ignore */
  }
}

/**
 * @returns {Promise<{ isLiveMarket: boolean, isWebSocketStreaming: boolean, isMarketHours: boolean, isTradingDay: boolean, marketPhase: string, mode: string, fetchedAt: number }>}
 */
export async function ensureMarketSession({ force = false } = {}) {
  const now = Date.now();
  if (!force && memory) {
    const maxAge = memory.isLiveMarket ? LIVE_STATUS_REFRESH_MS : CLOSED_STATUS_REFRESH_MS;
    if (now - memory.fetchedAt < maxAge) {
      return memory;
    }
  }
  if (!force) {
    const stored = loadStoredSession();
    if (stored) {
      const maxAge = stored.isLiveMarket ? LIVE_STATUS_REFRESH_MS : CLOSED_STATUS_REFRESH_MS;
      if (now - stored.fetchedAt < maxAge) {
        memory = stored;
        return stored;
      }
    }
  }

  if (inflight) {
    return inflight;
  }

  inflight = (async () => {
    try {
      const status = await fetchStatusRaw();
      const session = parseStatus(status);
      persistSession(session);
      return session;
    } catch (_) {
      const istSession = isNseRegularSessionIstNow();
      const prior = memory || loadStoredSession();
      const fallback = prior || {
        isLiveMarket: istSession,
        isWebSocketStreaming: false,
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
  return memory || loadStoredSession();
}

export function getEffectiveGetCacheTtlMs() {
  const session = getCachedMarketSession();
  if (session?.isLiveMarket) {
    return LIVE_GET_CACHE_MS;
  }
  return CLOSED_GET_CACHE_MS;
}

/** Polling interval: liveMs during market, closedMs when closed (0 = no polling). */
export function getMarketPollingIntervalMs(liveMs, closedMs = 0) {
  const session = getCachedMarketSession();
  if (shouldPollLiveMarket(session)) {
    return liveMs;
  }
  return closedMs;
}

/**
 * When market is closed, skip network if we have a page cache younger than CLOSED_PAGE_CACHE_MS.
 * @param {number|null|undefined} updatedAt - ms timestamp
 * @param {boolean} hasCache - whether any cached payload exists (legacy caches without updatedAt)
 */
export function shouldSkipNetworkForClosedMarket(updatedAt, hasCache = false) {
  const session = getCachedMarketSession();
  if (shouldPollLiveMarket(session)) {
    return false;
  }
  if (isPageCacheStale(updatedAt, session)) {
    return false;
  }
  if (!hasCache) {
    return false;
  }
  if (!updatedAt) {
    return true;
  }
  return Date.now() - updatedAt < CLOSED_PAGE_CACHE_MS;
}
