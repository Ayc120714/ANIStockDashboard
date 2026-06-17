export const MOBILE_PAGE_CACHE_KEYS = {
  dashboard: '@ani/mobile/page-cache/dashboard-v16',
  advisorSignals: '@ani/mobile/page-cache/advisor-signals-v4',
  screensHub: (main, gl, perM, perV, alphaHor, ipoFilter, screenDate = '') =>
    `@ani/mobile/page-cache/screens-v5-${main}-${gl}-${perM}-${perV}-${alphaHor}-${ipoFilter || 'all'}-${screenDate || 'live'}`,
  marketsOutlook: tab => `@ani/mobile/page-cache/markets-outlook-v2-${tab}`,
  stocksOutlook: tab => `@ani/mobile/page-cache/stocks-outlook-v4-${tab}`,
  watchlist: listType => `@ani/mobile/page-cache/watchlist-v5-${listType}`,
  advisorHubSignals: '@ani/mobile/page-cache/advisor-hub-signals-v3',
  advisorHubTrend: '@ani/mobile/page-cache/advisor-hub-trend-v10',
  advisorHubChart: '@ani/mobile/page-cache/advisor-hub-chart-v3',
  portfolio: '@ani/mobile/page-cache/portfolio-v2',
  orders: '@ani/mobile/page-cache/orders-v2',
  brokersSetup: userId => `@ani/mobile/page-cache/brokers-setup-v2-${userId || 'anon'}`,
  mutualFundsList: '@ani/mobile/page-cache/mf-list-v2',
  mutualFundsTiers: '@ani/mobile/page-cache/mf-tiers-v2',
  mutualFundsRs: mode => `@ani/mobile/page-cache/mf-rs-v2-${mode || 'or_signal'}`,
  marketsFno: '@ani/mobile/page-cache/markets-fno-v2',
  subsectorStocks: (subsector, page) =>
    `@ani/mobile/page-cache/subsector-stocks-v1-${encodeURIComponent(String(subsector || ''))}-p${page}`,
};

/** Dashboard has both top gainers and top losers (required for Market Movers card). */
export function hasDashboardMovers(payload) {
  if (!payload || typeof payload !== 'object') return false;
  const data = payload.data || payload;
  return (
    Array.isArray(data.gainers)
    && data.gainers.length > 0
    && Array.isArray(data.losers)
    && data.losers.length > 0
  );
}

/** True when cached dashboard has indices plus movers (minimum for showing dashboard). */
export function hasDashboardUsableContent(cached) {
  if (!cached) return false;
  const payload = cached.data || cached;
  if (!payload || typeof payload !== 'object') return false;
  const hasIndices = Array.isArray(payload.indices) && payload.indices.length > 0;
  const hasWatchlist = Array.isArray(payload.watchlist) && payload.watchlist.length > 0;
  return (hasIndices && hasDashboardMovers(payload)) || hasWatchlist;
}

export function isDashboardCacheIncomplete(cached) {
  if (!cached) return true;
  const payload = cached.data || cached;
  if (!payload || typeof payload !== 'object') return true;
  const hasIndices = Array.isArray(payload.indices) && payload.indices.length > 0;
  if (!hasIndices) return true;
  return !hasDashboardMovers(payload);
}

/** Which dashboard sections should be refetched (without clearing the whole cache). */
export function dashboardSectionsToRefresh(cached) {
  const payload = cached?.data || cached || {};
  return {
    indices: !Array.isArray(payload.indices) || payload.indices.length === 0,
    movers:
      !Array.isArray(payload.gainers)
      || !Array.isArray(payload.losers)
      || payload.gainers.length === 0
      || payload.losers.length === 0,
    watchlist: !Array.isArray(payload.watchlist),
    signals: !Array.isArray(payload.signals),
    weekly: !Array.isArray(payload.weeklyData),
    extras:
      !Array.isArray(payload.alerts)
      || !Array.isArray(payload.ratings)
      || !Array.isArray(payload.trending),
    optional: !Array.isArray(payload.sectorOutlook) || !Array.isArray(payload.orderBlocks),
  };
}

/** During NSE session, refresh volatile dashboard sections on each poll (incl. alerts). */
export function applyLiveSessionRefreshPolicy(need, liveSession) {
  if (!need || !liveSession) return need;
  need.indices = true;
  need.movers = true;
  need.watchlist = true;
  need.signals = true;
  need.extras = true;
  return need;
}

/**
 * Pull-to-refresh: update indices, movers, and watchlist first; defer heavy sections
 * so the refresh spinner clears before weekly entries, alerts, ratings, etc. finish.
 */
export function applyPullRefreshPolicy(need) {
  if (!need) return need;
  need.weekly = false;
  need.extras = false;
  need.optional = false;
  return need;
}

/** Trend tab: refresh only when cache is stale or grid has zero rows (not per-timeframe visible count). */
export function shouldRefreshAdvisorTrendCache({stale = false, trendHasData = false} = {}) {
  return Boolean(stale || !trendHasData);
}

export function shouldForceAdvisorTrendNetwork({stale = false, trendHasData = false} = {}) {
  return !trendHasData || stale;
}

/** Prior dashboard cache keys — cleared on upgrade so stale EOD shells are not reused. */
export const LEGACY_DASHBOARD_CACHE_KEYS = [
  '@ani/mobile/page-cache/dashboard-v15',
];

/** Prior cache keys — cleared on upgrade so empty/stale shells are not reused. */
export const LEGACY_ADVISOR_TREND_CACHE_KEYS = [
  '@ani/mobile/page-cache/advisor-hub-trend-v4',
  '@ani/mobile/page-cache/advisor-hub-trend-v5',
  '@ani/mobile/page-cache/advisor-hub-trend-v6',
  '@ani/mobile/page-cache/advisor-hub-trend-v7',
  '@ani/mobile/page-cache/advisor-hub-trend-v8',
  '@ani/mobile/page-cache/advisor-hub-trend-v9',
];
