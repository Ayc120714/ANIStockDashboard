import {ALWAYS_FETCH_FROM_DB} from '@core/config/dataRefreshPolicy';
import {
  ensureMarketSession,
  getCachedMarketSession,
  getMarketPollingIntervalMs,
  isPageCacheStale,
  shouldPollLiveMarket,
  shouldSkipNetworkForClosedMarket,
} from '@core/utils/marketSession';
import {cacheHasUsableData, readPageCache, writePageCache} from '@core/storage/pageCache';
import {fetchWithRetry} from '@core/utils/fetchWithRetry';

export const SCREEN_LIVE_POLL_MS = 30_000;

/** True when live session cache expired and a network refresh is warranted. */
export async function shouldRefreshPageCache(cacheKey, {forceRefresh = false} = {}) {
  if (forceRefresh) return true;
  await ensureMarketSession();
  const session = getCachedMarketSession();
  const cached = await readPageCache(cacheKey);
  if (!cached?.updatedAt) return true;
  return isPageCacheStale(cached.updatedAt, session);
}

export function extractRowArray(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.data)) return data.data;
  return [];
}

export async function shouldSkipScreenFetch(cacheKey) {
  if (ALWAYS_FETCH_FROM_DB) return false;
  await ensureMarketSession();
  const session = getCachedMarketSession();
  if (shouldPollLiveMarket(session)) return false;
  const cached = await readPageCache(cacheKey);
  if (!cached || !cacheHasUsableData(cached.data)) return false;
  if (isPageCacheStale(cached.updatedAt, session)) return false;
  return shouldSkipNetworkForClosedMarket(cached.updatedAt, true);
}

export async function runScreenTableFetch({
  cacheKey,
  fetcher,
  setRows,
  setLoading,
  setError,
  forceNetwork = false,
}) {
  if (setError) setError(null);

  let hydrated = false;
  const cached = await readPageCache(cacheKey);
  if (cached?.data != null) {
    const rows = extractRowArray(cached.data);
    const isRowPayload =
      Array.isArray(cached.data)
      || (cached.data && typeof cached.data === 'object' && Array.isArray(cached.data.data));
    if (isRowPayload) {
      setRows(rows);
      hydrated = true;
      if (setLoading) setLoading(false);
    }
  }

  if (!forceNetwork && !hydrated) {
    await ensureMarketSession();
  }

  if (!forceNetwork && hydrated && (await shouldSkipScreenFetch(cacheKey))) {
    if (setLoading) setLoading(false);
    return;
  }

  if (!hydrated && setLoading) setLoading(true);

  try {
    const fresh = await fetchWithRetry(fetcher, {retries: 1});
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
}) {
  if (setError) setError(null);

  let hydrated = false;
  const cached = await readPageCache(cacheKey);
  if (cached?.data != null && hasUsable(cached.data)) {
    applyPayload(cached.data);
    hydrated = true;
    if (setLoading) setLoading(false);
  }

  if (!forceNetwork && !hydrated) {
    await ensureMarketSession();
  }

  if (!forceNetwork && hydrated && (await shouldSkipScreenFetch(cacheKey))) {
    if (setLoading) setLoading(false);
    return;
  }

  if (!hydrated && setLoading) setLoading(true);

  try {
    const fresh = await fetchWithRetry(fetcher, {retries: 1});
    await writePageCache(cacheKey, fresh);
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

export async function runScreenTableFetchWithLivePoll({
  cacheKey,
  fetcher,
  setRows,
  setLoading,
  setError,
  liveIntervalMs = SCREEN_LIVE_POLL_MS,
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
  });

  await ensureMarketSession();
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
    });
  }, pollMs);
}
