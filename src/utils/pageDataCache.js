import { CLOSED_PAGE_CACHE_MS, ensureMarketSession, shouldSkipNetworkForClosedMarket } from './marketSession';

export function cacheHasUsableData(data) {
  if (data == null) return false;
  if (Array.isArray(data)) return data.length > 0;
  if (typeof data !== 'object') return false;

  if (Array.isArray(data.data)) {
    if (data.data.length > 0) return true;
    if (data.weekLabels) return false;
  }

  if (data.weekLabels && Array.isArray(data.data)) {
    return data.data.length > 0;
  }

  if (data.indexCards || data.smallcapCards || data.tableData) return true;
  if (data.watchlist && Array.isArray(data.watchlist)) return data.watchlist.length > 0;
  if (data.daily || data.weekly || data.monthly) return true;
  if (data.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
    return cacheHasUsableData(data.data);
  }

  return Object.keys(data).length > 0;
}

/**
 * Read sessionStorage page cache. Supports legacy bare arrays/objects.
 */
export function readPageCache(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && Object.prototype.hasOwnProperty.call(parsed, 'data')) {
      return {
        data: parsed.data,
        updatedAt: Number(parsed.updatedAt) || 0,
      };
    }
    return { data: parsed, updatedAt: 0 };
  } catch (_) {
    return null;
  }
}

export function writePageCache(key, data) {
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({
        data,
        updatedAt: Date.now(),
      }),
    );
  } catch (_) {
    /* ignore quota */
  }
}

export function clearPageCache(key) {
  try {
    sessionStorage.removeItem(key);
  } catch (_) {
    /* ignore */
  }
}

/**
 * True when off-market and an existing cache is fresh enough to avoid refetch.
 */
export async function shouldUseCachedPageDataOnly(cacheKey) {
  await ensureMarketSession();
  const cached = readPageCache(cacheKey);
  if (!cached || cached.data == null || !cacheHasUsableData(cached.data)) {
    return false;
  }
  return shouldSkipNetworkForClosedMarket(cached.updatedAt, true);
}

export function isPageCacheFresh(updatedAt) {
  if (!updatedAt) return true;
  return Date.now() - updatedAt < CLOSED_PAGE_CACHE_MS;
}
