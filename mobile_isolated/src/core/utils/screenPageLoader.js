import {ALWAYS_FETCH_FROM_DB} from '@core/config/dataRefreshPolicy';
import {
  ensureMarketSession,
  getCachedMarketSession,
  getFreshCachedMarketSession,
  getMarketPollingIntervalMs,
  isPageCacheStale,
  resolveMarketSession,
  shouldPollLiveMarket,
  shouldSkipNetworkForClosedMarket,
} from '@core/utils/marketSession';
import {cacheHasUsableData, readPageCache, writePageCache} from '@core/storage/pageCache';
import {fetchWithRetry} from '@core/utils/fetchWithRetry';

export const SCREEN_LIVE_POLL_MS = 30_000;

async function resolveSessionForCacheDecision() {
  return getFreshCachedMarketSession() || getCachedMarketSession() || ensureMarketSession();
}

/** True when live session cache expired and a network refresh is warranted. */
export async function shouldRefreshPageCache(cacheKey, {forceRefresh = false} = {}) {
  if (forceRefresh) return true;
  const session = await resolveSessionForCacheDecision();
  const cached = await readPageCache(cacheKey);
  if (!cached?.updatedAt) return true;
  return isPageCacheStale(cached.updatedAt, session);
}

export function extractRowArray(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.data)) return data.data;
  return [];
}

async function shouldSkipScreenFetch(cacheKey, cachedWrap = null) {
  if (ALWAYS_FETCH_FROM_DB) return false;
  const session = await resolveSessionForCacheDecision();
  if (shouldPollLiveMarket(session)) return false;
  const cached = cachedWrap || (await readPageCache(cacheKey));
  if (!cached || !cacheHasUsableData(cached.data)) return false;
  if (isPageCacheStale(cached.updatedAt, session)) return false;
  return shouldSkipNetworkForClosedMarket(cached.updatedAt, true);
}

/** Refresh from network without blocking the UI when cache is already shown. */
function scheduleBackgroundTableRefresh({
  cacheKey,
  fetcher,
  setRows,
  setError,
  forceNetwork = false,
}) {
  const retries = forceNetwork ? 1 : 0;
  void (async () => {
    try {
      const fresh = await fetchWithRetry(fetcher, {retries});
      const rows = extractRowArray(fresh);
      await writePageCache(cacheKey, Array.isArray(fresh) ? fresh : rows);
      setRows(rows);
      if (setError) setError(null);
    } catch (e) {
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
  const retries = forceNetwork ? 1 : 0;
  void (async () => {
    try {
      const fresh = await fetchWithRetry(fetcher, {retries});
      if (hasUsable(fresh)) {
        await writePageCache(cacheKey, fresh);
        applyPayload(fresh);
      }
      if (setError) setError(null);
    } catch {
      if (setError) setError(null);
    }
  })();
}

export async function runScreenTableFetch({
  cacheKey,
  fetcher,
  setRows,
  setLoading,
  setError,
  forceNetwork = false,
  silent = false,
}) {
  if (setError) setError(null);

  let hydrated = false;
  const cachedWrap = await readPageCache(cacheKey);
  if (cachedWrap?.data != null) {
    const rows = extractRowArray(cachedWrap.data);
    const isRowPayload =
      Array.isArray(cachedWrap.data)
      || (cachedWrap.data && typeof cachedWrap.data === 'object' && Array.isArray(cachedWrap.data.data));
    if (isRowPayload && rows.length > 0) {
      setRows(rows);
      hydrated = true;
      if (setLoading) setLoading(false);
    }
  }

  if (!forceNetwork && hydrated) {
    if (await shouldSkipScreenFetch(cacheKey, cachedWrap)) {
      if (setLoading) setLoading(false);
      return;
    }
    scheduleBackgroundTableRefresh({cacheKey, fetcher, setRows, setError, forceNetwork});
    return;
  }

  if (!hydrated && setLoading && !silent) setLoading(true);

  const sessionPromise = !forceNetwork && !getFreshCachedMarketSession()
    ? ensureMarketSession()
    : Promise.resolve(getFreshCachedMarketSession() || getCachedMarketSession());

  try {
    const [fresh] = await Promise.all([fetchWithRetry(fetcher, {retries: forceNetwork ? 1 : 0}), sessionPromise]);
    const rows = extractRowArray(fresh);
    await writePageCache(cacheKey, Array.isArray(fresh) ? fresh : rows);
    setRows(rows);
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
  const cachedWrap = await readPageCache(cacheKey);
  if (cachedWrap?.data != null && hasUsable(cachedWrap.data)) {
    applyPayload(cachedWrap.data);
    hydrated = true;
    if (setLoading) setLoading(false);
  }

  if (!forceNetwork && hydrated) {
    if (await shouldSkipScreenFetch(cacheKey, cachedWrap)) {
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

  const sessionPromise = !forceNetwork && !getFreshCachedMarketSession()
    ? ensureMarketSession()
    : Promise.resolve(getFreshCachedMarketSession() || getCachedMarketSession());

  try {
    const [fresh] = await Promise.all([
      fetchWithRetry(fetcher, {retries: forceNetwork ? 1 : 0}),
      sessionPromise,
    ]);
    if (hasUsable(fresh)) {
      await writePageCache(cacheKey, fresh);
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

/** Pull-to-refresh: show cached payload immediately, refresh in background when cache exists. */
export async function runScreenPayloadRefresh({
  cacheKey,
  fetcher,
  applyPayload,
  setRefreshing,
  setLoading,
  setError,
  hasUsable = cacheHasUsableData,
}) {
  if (setError) setError(null);
  if (setRefreshing) setRefreshing(true);

  const cachedWrap = await readPageCache(cacheKey);
  if (cachedWrap?.data != null && hasUsable(cachedWrap.data)) {
    applyPayload(cachedWrap.data);
    if (setLoading) setLoading(false);
    if (setRefreshing) setRefreshing(false);
    scheduleBackgroundPayloadRefresh({
      cacheKey,
      fetcher,
      applyPayload,
      setError,
      hasUsable,
      forceNetwork: true,
    });
    return;
  }

  if (setLoading) setLoading(true);
  try {
    const fresh = await fetchWithRetry(fetcher, {retries: 1});
    if (hasUsable(fresh)) {
      await writePageCache(cacheKey, fresh);
    }
    applyPayload(fresh);
    if (setError) setError(null);
  } catch (e) {
    if (setError) setError(e?.message || 'Failed to load data.');
  } finally {
    if (setLoading) setLoading(false);
    if (setRefreshing) setRefreshing(false);
  }
}

export async function runScreenTableFetchWithLivePoll({
  cacheKey,
  fetcher,
  setRows,
  setLoading,
  setError,
  liveIntervalMs = SCREEN_LIVE_POLL_MS,
}) {
  const session = await resolveMarketSession();

  await runScreenTableFetch({
    cacheKey,
    fetcher,
    setRows,
    setLoading,
    setError,
    forceNetwork: shouldPollLiveMarket(session),
  });

  const pollMs = getMarketPollingIntervalMs(liveIntervalMs, 0);
  if (pollMs <= 0) return undefined;

  return setInterval(() => {
    runScreenTableFetch({
      cacheKey,
      fetcher,
      setRows,
      setLoading: () => {},
      setError,
      forceNetwork: true,
      silent: true,
    });
  }, pollMs);
}

export async function runScreenPayloadFetchWithLivePoll({
  cacheKey,
  fetcher,
  applyPayload,
  setLoading,
  setError,
  hasUsable = cacheHasUsableData,
  liveIntervalMs = SCREEN_LIVE_POLL_MS,
}) {
  const session = await resolveMarketSession();

  await runScreenPayloadFetch({
    cacheKey,
    fetcher,
    applyPayload,
    setLoading,
    setError,
    forceNetwork: shouldPollLiveMarket(session),
    hasUsable,
  });

  const pollMs = getMarketPollingIntervalMs(liveIntervalMs, 0);
  if (pollMs <= 0) return undefined;

  return setInterval(() => {
    runScreenPayloadFetch({
      cacheKey,
      fetcher,
      applyPayload,
      setLoading: () => {},
      setError,
      forceNetwork: true,
      hasUsable,
      silent: true,
    });
  }, pollMs);
}
