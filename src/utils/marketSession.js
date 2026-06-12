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
      const fallback = memory || loadStoredSession() || {
        isLiveMarket: false,
        isWebSocketStreaming: false,
        isMarketHours: false,
        isTradingDay: false,
        marketPhase: 'off_hours',
        mode: 'unknown',
        fetchedAt: now,
      };
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
  if (session?.isLiveMarket) {
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
  if (session?.isLiveMarket) {
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
