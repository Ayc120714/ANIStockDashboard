/**
 * Session page-cache keys for live-market navigation (OHLCV cache-sync agent).
 * Keep versions in sync across pages, prefetchAppShellData, and tests.
 */
export const LIVE_PAGE_CACHE_KEYS = {
  dashboard: 'dashboard_overview_cache_v15',
  marketOutlook: 'marketOutlookData_v3',
  fiiDii: 'marketOutlookFiiDii_v5',
  sectorOutlook: 'sectorOutlookData_v2',
  subsectorOutlook: 'subsectorOutlookData_v3',
  aiPicks: 'aiWeeklyPicks_v1',
  liveSetups: 'liveSetupsEntryReady_v3',
  shortTermWatchlist: 'shortTermWatchlist_v5',
  longTermWatchlist: 'longTermWatchlist_v5',
  chartFundamental: 'advisor_chart_fundamental_agent_v7',
  trendReversal: 'advisor_trend_reversal_grid_v3',
  volumeShockers: (userKey = 'default', period = 'day', limit = 50) =>
    `volumeShockersData_v6_${userKey}_${period}_${limit}`,
  priceShockers: (type = 'gainers', period = 'day', limit = 50) =>
    `priceShockersData_v5_${type}_${period}_${limit}`,
  trending: (limit = 50) => `trendingStocksData_v4_${limit}`,
};
export const AI_PICKS_CACHE_KEY = LIVE_PAGE_CACHE_KEYS.aiPicks;
