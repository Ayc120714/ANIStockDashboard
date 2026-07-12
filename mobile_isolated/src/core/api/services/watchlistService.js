import {apiPost, apiRequest} from '@core/api/apiClient';
import {API_TIMEOUT_MS} from '@core/config/apiTimeouts';
import {clearPageCache} from '@core/storage/pageCache';
import {MOBILE_PAGE_CACHE_KEYS} from '@core/utils/dashboardCachePolicy';

const T = API_TIMEOUT_MS.screen;

export const normalizeWatchlistSymbol = value => String(value || '').trim().toUpperCase();

async function invalidateWatchlistCache(listType) {
  const horizon = listType === 'short_term' ? 'short_term' : 'long_term';
  await clearPageCache(MOBILE_PAGE_CACHE_KEYS.watchlist(horizon));
  // Dashboard renders a watchlist strip from its own page cache — clear it too
  // or it keeps showing pre-mutation symbols until its TTL expires.
  await clearPageCache(MOBILE_PAGE_CACHE_KEYS.dashboard);
}

export const watchlistService = {
  addToWatchlist: async (symbol, listType, notes = '') => {
    const res = await apiPost(
      '/watchlist',
      {
        symbol: normalizeWatchlistSymbol(symbol),
        list_type: listType,
        notes: String(notes || ''),
      },
      {timeoutMs: T},
    );
    await invalidateWatchlistCache(listType);
    return res;
  },

  removeFromWatchlist: async (symbol, listType) => {
    const res = await apiRequest(
      `/watchlist/symbol/${encodeURIComponent(normalizeWatchlistSymbol(symbol))}?list_type=${encodeURIComponent(listType)}`,
      {method: 'DELETE', timeoutMs: T},
    );
    await invalidateWatchlistCache(listType);
    return res;
  },

  bulkDeleteFromWatchlist: async (symbols, listType) => {
    const res = await apiPost(
      '/watchlist/bulk-delete',
      {
        symbols: (symbols || []).map(normalizeWatchlistSymbol).filter(Boolean),
        list_type: listType,
      },
      {timeoutMs: T},
    );
    await invalidateWatchlistCache(listType);
    return res;
  },
};
