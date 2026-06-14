import {
  ensureMarketSession,
  getCachedMarketSession,
  getMarketPollingIntervalMs,
  isPageCacheStale,
  shouldPollLiveMarket,
  shouldSkipNetworkForClosedMarket,
} from '@core/utils/marketSession';
import {cacheHasUsableData, readPageCache, writePageCache} from '@core/storage/pageCache';

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
    if (rows.length > 0) {
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
    const fresh = await fetcher();
    const rows = extractRowArray(fresh);
    await writePageCache(cacheKey, Array.isArray(fresh) ? fresh : rows);
    setRows(rows);
    if (setError) setError(null);
  } catch (e) {
    if (!hydrated) {
      if (setError) setError(e?.message || 'Failed to load data.');
      setRows([]);
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
    const fresh = await fetcher();
    await writePageCache(cacheKey, fresh);
    applyPayload(fresh);
    if (setError) setError(null);
  } catch (e) {
    if (!hydrated) {
      if (setError) setError(e?.message || 'Failed to load data.');
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
