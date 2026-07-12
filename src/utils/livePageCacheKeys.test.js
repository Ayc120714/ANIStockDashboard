import { LIVE_PAGE_CACHE_KEYS } from './livePageCacheKeys';

describe('livePageCacheKeys', () => {
  it('exposes stable keys for live-market page cache policy', () => {
    expect(LIVE_PAGE_CACHE_KEYS.dashboard).toBe('dashboard_overview_cache_v13');
    expect(LIVE_PAGE_CACHE_KEYS.liveSetups).toBe('liveSetupsEntryReady_v1');
    expect(LIVE_PAGE_CACHE_KEYS.chartFundamental).toBe('advisor_chart_fundamental_agent_v6');
    expect(LIVE_PAGE_CACHE_KEYS.trendReversal).toBe('advisor_trend_reversal_grid_v3');
    expect(LIVE_PAGE_CACHE_KEYS.trending(50)).toBe('trendingStocksData_v3_50');
  });

  it('keeps watchlist prefetch keys in sync with ST/LT pages (regression)', () => {
    // Bug: prefetch warmed shortTermWatchlist_v3 while pages read _v4 — the
    // login warm-up never hit. Pages now import these constants directly.
    expect(LIVE_PAGE_CACHE_KEYS.shortTermWatchlist).toBe('shortTermWatchlist_v4');
    expect(LIVE_PAGE_CACHE_KEYS.longTermWatchlist).toBe('longTermWatchlist_v4');
  });

  it('scopes volume shockers prefetch key by user like the page does (regression)', () => {
    expect(LIVE_PAGE_CACHE_KEYS.volumeShockers('u42', 'day', 50)).toBe('volumeShockersData_v5_u42_day_50');
    expect(LIVE_PAGE_CACHE_KEYS.volumeShockers(undefined, 'day', 50)).toBe('volumeShockersData_v5_default_day_50');
  });
});
