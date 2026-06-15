import AsyncStorage from '@react-native-async-storage/async-storage';
import {ALWAYS_FETCH_FROM_DB} from '@core/config/dataRefreshPolicy';
import {countTrendGridRows} from '@core/utils/advisorHubCache';
import {ensureMarketSession, getCachedMarketSession, getFreshCachedMarketSession, shouldSkipNetworkForClosedMarket} from '@core/utils/marketSession';

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

  if (Array.isArray(data.indices) && data.indices.length > 0) return true;
  if (Array.isArray(data.gainers) && data.gainers.length > 0) return true;
  if (Array.isArray(data.losers) && data.losers.length > 0) return true;
  if (data.indexCards || data.smallcapCards || data.tableData) return true;
  if (data.watchlist && Array.isArray(data.watchlist)) return data.watchlist.length > 0;
  if (data.trendGrid != null) {
    return countTrendGridRows(data) > 0;
  }
  if (data.daily || data.weekly || data.monthly) {
    return countTrendGridRows(data) > 0;
  }
  if (data.rows && Array.isArray(data.rows)) return data.rows.length > 0;
  if (data.fii != null || data.grouped != null) return true;
  if (data.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
    return cacheHasUsableData(data.data);
  }

  return Object.keys(data).length > 0;
}

export async function readPageCache(key) {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && Object.prototype.hasOwnProperty.call(parsed, 'data')) {
      return {
        data: parsed.data,
        updatedAt: Number(parsed.updatedAt) || Number(parsed.cached_at) || 0,
      };
    }
    return {data: parsed, updatedAt: 0};
  } catch {
    return null;
  }
}

export async function writePageCache(key, data) {
  try {
    await AsyncStorage.setItem(
      key,
      JSON.stringify({
        data,
        updatedAt: Date.now(),
      }),
    );
  } catch {
    /* ignore quota */
  }
}

export async function clearPageCache(key) {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** True when off-market and an existing cache is fresh enough to avoid refetch. */
export async function shouldUseCachedPageDataOnly(cacheKey) {
  if (ALWAYS_FETCH_FROM_DB) return false;
  const session = getFreshCachedMarketSession() || getCachedMarketSession() || (await ensureMarketSession());
  const cached = await readPageCache(cacheKey);
  if (!cached || cached.data == null || !cacheHasUsableData(cached.data)) {
    return false;
  }
  return shouldSkipNetworkForClosedMarket(cached.updatedAt, true);
}
