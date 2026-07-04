/**
 * Session page-cache keys for live-market navigation (OHLCV cache-sync agent).
 * Keep versions in sync across pages, prefetchAppShellData, and tests.
 */
export const LIVE_PAGE_CACHE_KEYS = {
  dashboard: 'dashboard_overview_cache_v11',
  marketOutlook: 'marketOutlookData_v3',
  fiiDii: 'marketOutlookFiiDii_v2',
  sectorOutlook: 'sectorOutlookData',
  subsectorOutlook: 'subsectorOutlookData_v3',
  aiPicks: 'aiWeeklyPicks_v1',
  liveSetups: 'liveSetupsEntryReady_v1',
  shortTermWatchlist: 'shortTermWatchlist_v3',
  longTermWatchlist: 'longTermWatchlist_v3',
  chartFundamental: 'advisor_chart_fundamental_agent_v6',
  trendReversal: 'advisor_trend_reversal_grid_v3',
  trending: (limit = 50) => `trendingStocksData_v3_${limit}`,
  priceShockers: (type = 'gainers', period = 'day', limit = 50) =>
    `priceShockersData_v4_${type}_${period}_${limit}`,
  volumeShockers: (period = 'day', limit = 50) =>
    `volumeShockersData_v5_default_${period}_${limit}`,
};

export const AI_PICKS_CACHE_KEY = LIVE_PAGE_CACHE_KEYS.aiPicks;
