import { hasDuplicateWeeklyEntrySymbols } from './weeklyEntries';

const payloadOf = (cached) => {
  if (!cached || typeof cached !== 'object') return null;
  if (cached.data && typeof cached.data === 'object') return cached.data;
  return cached;
};

/** Web dashboard stores `fetchMarketIndices()` object (indexCards), not a row array. */
export const hasDashboardIndices = (cached) => {
  const payload = payloadOf(cached);
  if (!payload?.indices) return false;
  if (Array.isArray(payload.indices) && payload.indices.length > 0) return true;
  const cards = [
    ...(payload.indices?.indexCards || []),
    ...(payload.indices?.smallcapCards || []),
  ];
  return cards.length > 0;
};

export const hasDashboardWatchlist = (cached) => {
  const payload = payloadOf(cached);
  return Array.isArray(payload?.watchlist) && payload.watchlist.length > 0;
};

export const hasDashboardMovers = (cached) => {
  const payload = payloadOf(cached);
  return (
    Array.isArray(payload?.gainers)
    && payload.gainers.length > 0
    && Array.isArray(payload?.losers)
    && payload.losers.length > 0
  );
};

export const hasDashboardMinimumVisibleContent = (cached) =>
  hasDashboardIndices(cached) || hasDashboardMovers(cached) || hasDashboardWatchlist(cached);

export const isDashboardCacheIncomplete = (cached) => {
  if (!cached) return true;
  const payload = payloadOf(cached);
  if (!payload || typeof payload !== 'object') return true;
  if (hasDashboardWatchlist(cached)) return false;
  if (!hasDashboardIndices(cached)) return true;
  if (!hasDashboardMovers(cached)) return true;
  if (
    hasDuplicateWeeklyEntrySymbols(payload.weeklyData)
    && !hasDashboardWatchlist(cached)
  ) {
    return true;
  }
  return false;
};

export const pickDashboardSectionRows = (section, freshRows, fallback) => {
  if (Array.isArray(freshRows) && freshRows.length > 0) return freshRows;
  const cachedRows = fallback?.[section];
  return Array.isArray(cachedRows) ? cachedRows : [];
};

export const buildDashboardRefreshFallback = (cached) => {
  const payload = payloadOf(cached);
  if (!payload || typeof payload !== 'object') return {};
  return { ...payload };
};

export const applyPullRefreshPolicy = (need) => {
  if (!need || typeof need !== 'object') return need;
  need.indices = true;
  need.movers = true;
  need.watchlist = true;
  need.extras = true;
  return need;
};

export const dashboardSectionsToRefresh = (cached) => {
  const payload = payloadOf(cached) || {};
  return {
    indices: !hasDashboardIndices(cached),
    movers: !hasDashboardMovers(cached),
    // Always refetch watchlist when loading dashboard — day1d/CMP must match EOD overlays (subsector parity).
    watchlist: true,
    extras:
      !Array.isArray(payload.signals)
      || !Array.isArray(payload.weeklyData)
      || !Array.isArray(payload.alerts)
      || !Array.isArray(payload.ratings)
      || !Array.isArray(payload.trendingStocks)
      || !Array.isArray(payload.sectors)
      || !Array.isArray(payload.obData),
  };
};

export const applyLiveSessionRefreshPolicy = (need, liveSession) => {
  if (!liveSession || !need) return need;
  need.indices = true;
  need.movers = true;
  need.watchlist = true;
  need.extras = true;
  return need;
};
