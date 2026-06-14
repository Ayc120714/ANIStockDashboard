export const MOBILE_PAGE_CACHE_KEYS = {
  dashboard: '@ani/mobile/page-cache/dashboard-v2',
  advisorSignals: '@ani/mobile/page-cache/advisor-signals-v2',
  screensHub: (main, gl, perM, perV, alphaHor, ipoFilter) =>
    `@ani/mobile/page-cache/screens-${main}-${gl}-${perM}-${perV}-${alphaHor}-${ipoFilter || 'all'}`,
  marketsOutlook: tab => `@ani/mobile/page-cache/markets-outlook-${tab}`,
  stocksOutlook: tab => `@ani/mobile/page-cache/stocks-outlook-${tab}`,
  watchlist: listType => `@ani/mobile/page-cache/watchlist-${listType}`,
  advisorHubSignals: '@ani/mobile/page-cache/advisor-hub-signals-v1',
  advisorHubTrend: '@ani/mobile/page-cache/advisor-hub-trend-v1',
  advisorHubChart: '@ani/mobile/page-cache/advisor-hub-chart-v1',
  portfolio: '@ani/mobile/page-cache/portfolio-v1',
  orders: '@ani/mobile/page-cache/orders-v1',
  brokersSetup: userId => `@ani/mobile/page-cache/brokers-setup-${userId || 'anon'}`,
  mutualFundsList: '@ani/mobile/page-cache/mf-list-v1',
  mutualFundsTiers: '@ani/mobile/page-cache/mf-tiers-v1',
  mutualFundsRs: mode => `@ani/mobile/page-cache/mf-rs-${mode || 'or_signal'}`,
};

export function isDashboardCacheIncomplete(cached) {
  if (!cached) return true;
  const hasIndices = Boolean(cached.indices);
  const gainers = cached.gainers;
  const losers = cached.losers;
  if (
    hasIndices
    && Array.isArray(losers)
    && losers.length > 0
    && (!Array.isArray(gainers) || gainers.length === 0)
  ) {
    return true;
  }
  return false;
}
