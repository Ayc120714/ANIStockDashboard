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
import { ensureLegacyFormattedScreenCachesPurged } from './screenStockCache';

/** Default refresh for screen tables while orchestrator is updating live DB rows. */
export const SCREEN_LIVE_POLL_MS = 30_000;

export function extractRowArray(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.data)) return data.data;
  return [];
}

export async function shouldSkipScreenFetch(cacheKey) {
  await ensureMarketSession();
  const session = getCachedMarketSession();
  if (shouldPollLiveMarket(session)) return false;
  const cached = readPageCache(cacheKey);
  if (!cached || !cacheHasUsableData(cached.data)) return false;
  if (isPageCacheStale(cached.updatedAt, session)) return false;
  return shouldSkipNetworkForClosedMarket(cached.updatedAt, true);
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
      setLoading(false);
    }
  }

  if (!forceNetwork && !hydrated) {
    await ensureMarketSession();
  }

  if (!forceNetwork && hydrated && (await shouldSkipScreenFetch(cacheKey))) {
    setLoading(false);
    return;
  }

  if (!hydrated) setLoading(true);

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
    }
  } finally {
    setLoading(false);
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
}) {
  if (setError) setError(null);

  let hydrated = false;
  const cached = readPageCache(cacheKey);
  if (cached?.data != null && hasUsable(cached.data)) {
    applyPayload(cached.data);
    hydrated = true;
    setLoading(false);
  }

  if (!forceNetwork && !hydrated) {
    await ensureMarketSession();
  }

  if (!forceNetwork && hydrated && (await shouldSkipScreenFetch(cacheKey))) {
    setLoading(false);
    return;
  }

  if (!hydrated) setLoading(true);

  try {
    const fresh = await fetcher();
    writePageCache(cacheKey, fresh);
    applyPayload(fresh);
    if (setError) setError(null);
  } catch (e) {
    if (!hydrated) {
      if (setError) setError(e?.message || 'Failed to load data.');
    }
  } finally {
    setLoading(false);
  }
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
  const session = getCachedMarketSession();

  await runScreenTableFetch({
    cacheKey,
    fetcher,
    setRows,
    setLoading,
    setError,
    forceNetwork: shouldPollLiveMarket(session),
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
