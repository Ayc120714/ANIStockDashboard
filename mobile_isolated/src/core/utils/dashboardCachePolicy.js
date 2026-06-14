export const MOBILE_PAGE_CACHE_KEYS = {
  dashboard: '@ani/mobile/page-cache/dashboard-v14',
  advisorSignals: '@ani/mobile/page-cache/advisor-signals-v3',
  screensHub: (main, gl, perM, perV, alphaHor, ipoFilter, screenDate = '') =>
    `@ani/mobile/page-cache/screens-v4-${main}-${gl}-${perM}-${perV}-${alphaHor}-${ipoFilter || 'all'}-${screenDate || 'live'}`,
  marketsOutlook: tab => `@ani/mobile/page-cache/markets-outlook-v2-${tab}`,
  stocksOutlook: tab => `@ani/mobile/page-cache/stocks-outlook-v4-${tab}`,
  watchlist: listType => `@ani/mobile/page-cache/watchlist-v4-${listType}`,
  advisorHubSignals: '@ani/mobile/page-cache/advisor-hub-signals-v2',
  advisorHubTrend: '@ani/mobile/page-cache/advisor-hub-trend-v5',
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
