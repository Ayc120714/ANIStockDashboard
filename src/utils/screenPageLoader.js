import { clearApiGetCache } from '../api/apiClient';
import {
  ensureMarketSession,
  getCachedMarketSession,
  getMarketPollingIntervalMs,
  isPageCacheStale,
  shouldPollLiveMarket,
  shouldSkipNetworkForClosedMarket,
} from './marketSession';
import { cacheHasUsableData, readPageCache, writePageCache } from './pageDataCache';
import { watchlistPayloadHasUsableMarketData } from './watchlistCachePolicy';
import { ensureLegacyFormattedScreenCachesPurged } from './screenStockCache';

/** Default refresh for screen tables while orchestrator is updating live DB rows. */
export const SCREEN_LIVE_POLL_MS = 30_000;

/**
 * Standard mount + poll for live-market pages (cache-first navigation).
 * Mount: forceNetwork=false. Interval polls: forceNetwork=true, silent=true.
 */
export async function runLiveMarketPageMountPoll({
  load,
  liveIntervalMs = SCREEN_LIVE_POLL_MS,
  onCleanup,
}) {
  await ensureMarketSession();
  await load({ silent: false, forceNetwork: false });
  await ensureMarketSession();
  const pollMs = getMarketPollingIntervalMs(liveIntervalMs, 0);
  if (pollMs <= 0) return undefined;
  const id = setInterval(() => {
    load({ silent: true, forceNetwork: true });
  }, pollMs);
  onCleanup?.(() => clearInterval(id));
  return id;
}

export function extractRowArray(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.data)) return data.data;
  return [];
}

export async function shouldSkipScreenFetch(cacheKey, cachedWrap = null) {
  await ensureMarketSession();
  const session = getCachedMarketSession();
  if (shouldPollLiveMarket(session)) return false;
  const cached = cachedWrap || readPageCache(cacheKey);
  if (!cached || !cacheHasUsableData(cached.data)) return false;
  if (isPageCacheStale(cached.updatedAt, session)) return false;
  return shouldSkipNetworkForClosedMarket(cached.updatedAt, true);
}

function scheduleBackgroundTableRefresh({
  cacheKey,
  fetcher,
  setRows,
  setError,
  forceNetwork = false,
  mapRows = (rows) => rows,
}) {
  void (async () => {
    try {
      const session = getCachedMarketSession();
      if (forceNetwork && shouldPollLiveMarket(session)) {
        clearApiGetCache();
      }
      const fresh = await fetcher();
      const raw = extractRowArray(fresh);
      writePageCache(cacheKey, Array.isArray(fresh) ? fresh : raw);
      setRows(mapRows(raw));
      if (setError) setError(null);
    } catch (_) {
      if (setError) setError(null);
    }
  })();
}

function scheduleBackgroundPayloadRefresh({
  cacheKey,
  fetcher,
  applyPayload,
  setError,
  hasUsable,
  forceNetwork = false,
}) {
  void (async () => {
    try {
      const fresh = await fetcher();
      if (hasUsable(fresh)) {
        writePageCache(cacheKey, fresh);
        applyPayload(fresh);
      }
      if (setError) setError(null);
    } catch (_) {
      if (setError) setError(null);
    }
  })();
}

/**
 * Load a table-style screen (array rows). Hydrates cache first; skips network when market closed.
 */
export async function runScreenTableFetch({
  cacheKey,
  fetcher,
  setRows,
  setLoading,
  setError,
  forceNetwork = false,
  silent = false,
  mapRows = (rows) => rows,
}) {
  ensureLegacyFormattedScreenCachesPurged();
  if (setError) setError(null);

  let hydrated = false;
  const cached = readPageCache(cacheKey);
  if (cached?.data != null) {
    const rows = mapRows(extractRowArray(cached.data));
    if (rows.length > 0) {
      setRows(rows);
      hydrated = true;
      if (setLoading) setLoading(false);
    }
  }

  if (!forceNetwork && hydrated) {
    if (await shouldSkipScreenFetch(cacheKey, cached)) {
      if (setLoading) setLoading(false);
      return;
    }
    scheduleBackgroundTableRefresh({
      cacheKey,
      fetcher,
      setRows,
      setError,
      forceNetwork,
      mapRows,
    });
    return;
  }

  if (!hydrated && setLoading && !silent) setLoading(true);

  if (!forceNetwork && !hydrated) {
    await ensureMarketSession();
  }

  try {
    const session = getCachedMarketSession();
    if (forceNetwork && shouldPollLiveMarket(session)) {
      clearApiGetCache();
    }
    const fresh = await fetcher();
    const raw = extractRowArray(fresh);
    writePageCache(cacheKey, Array.isArray(fresh) ? fresh : raw);
    setRows(mapRows(raw));
    if (setError) setError(null);
  } catch (e) {
    if (!hydrated) {
      if (setError) setError(e?.message || 'Failed to load data.');
      setRows([]);
    } else if (setError) {
      setError(null);
    }
  } finally {
    if (setLoading) setLoading(false);
  }
}

/**
 * Load a structured payload (subsector, market outlook, trend grid).
 */
export async function runScreenPayloadFetch({
  cacheKey,
  fetcher,
  applyPayload,
  setLoading,
  setError,
  forceNetwork = false,
  hasUsable = cacheHasUsableData,
  silent = false,
}) {
  if (setError) setError(null);

  let hydrated = false;
  const cached = readPageCache(cacheKey);
  if (cached?.data != null && hasUsable(cached.data)) {
    applyPayload(cached.data);
    hydrated = true;
    if (setLoading) setLoading(false);
  }

  if (!forceNetwork && hydrated) {
    if (await shouldSkipScreenFetch(cacheKey, cached)) {
      if (setLoading) setLoading(false);
      return;
    }
    scheduleBackgroundPayloadRefresh({
      cacheKey,
      fetcher,
      applyPayload,
      setError,
      hasUsable,
      forceNetwork,
    });
    return;
  }

  if (!hydrated && setLoading && !silent) setLoading(true);

  if (!forceNetwork && !hydrated) {
    await ensureMarketSession();
  }

  try {
    const fresh = await fetcher();
    if (hasUsable(fresh)) {
      writePageCache(cacheKey, fresh);
    }
    applyPayload(fresh);
    if (setError) setError(null);
  } catch (e) {
    if (!hydrated) {
      if (setError) setError(e?.message || 'Failed to load data.');
    } else if (setError) {
      setError(null);
    }
  } finally {
    if (setLoading) setLoading(false);
  }
}

/** Watchlist + signals pages (Short Term / Long Term). */
export async function runWatchlistPageFetch({
  cacheKey,
  fetcher,
  applyPayload,
  setLoading,
  setError,
  forceNetwork = false,
  silent = false,
}) {
  return runScreenPayloadFetch({
    cacheKey,
    fetcher,
    applyPayload,
    setLoading,
    setError,
    forceNetwork,
    silent,
    hasUsable: (data) => Boolean(
      data
      && Array.isArray(data.watchlist)
      && data.watchlist.length > 0
      && watchlistPayloadHasUsableMarketData(data),
    ),
  });
}

/**
 * Run a screen table load on mount and poll while market is live (today view only).
 * @param {boolean} isHistoricalView - when true, no live polling (snapshot date selected)
 */
export async function runScreenTableFetchWithLivePoll({
  cacheKey,
  fetcher,
  setRows,
  setLoading,
  setError,
  isHistoricalView = false,
  liveIntervalMs = SCREEN_LIVE_POLL_MS,
  onCleanup,
  mapRows,
}) {
  await ensureMarketSession();

  await runScreenTableFetch({
    cacheKey,
    fetcher,
    setRows,
    setLoading,
    setError,
    forceNetwork: false,
    mapRows,
  });

  if (isHistoricalView) {
    return undefined;
  }

  await ensureMarketSession();
  const pollMs = getMarketPollingIntervalMs(liveIntervalMs, 0);
  if (pollMs <= 0) {
    return undefined;
  }

  const id = setInterval(() => {
    runScreenTableFetch({
      cacheKey,
      fetcher,
      setRows,
      setLoading,
      setError,
      forceNetwork: true,
      mapRows,
    });
  }, pollMs);

  onCleanup?.(() => clearInterval(id));
  return id;
}

export function useMarketPoll(loadFn, liveIntervalMs, deps = []) {
  // eslint-disable-next-line react-hooks/rules-of-hooks -- utility for copy-paste in effects
  return async (onCleanup) => {
    await loadFn();
    await ensureMarketSession();
    const pollMs = getMarketPollingIntervalMs(liveIntervalMs, 0);
    if (pollMs <= 0) return undefined;
    const id = setInterval(() => loadFn(), pollMs);
    onCleanup?.(() => clearInterval(id));
    return id;
  };
}
