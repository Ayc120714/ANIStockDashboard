import { LIVE_PAGE_CACHE_KEYS } from './livePageCacheKeys';

describe('livePageCacheKeys', () => {
  it('exposes stable keys for live-market page cache policy', () => {
    expect(LIVE_PAGE_CACHE_KEYS.dashboard).toBe('dashboard_overview_cache_v11');
    expect(LIVE_PAGE_CACHE_KEYS.liveSetups).toBe('liveSetupsEntryReady_v1');
    expect(LIVE_PAGE_CACHE_KEYS.chartFundamental).toBe('advisor_chart_fundamental_agent_v6');
    expect(LIVE_PAGE_CACHE_KEYS.trendReversal).toBe('advisor_trend_reversal_grid_v3');
    expect(LIVE_PAGE_CACHE_KEYS.trending(50)).toBe('trendingStocksData_v3_50');
  });
});
