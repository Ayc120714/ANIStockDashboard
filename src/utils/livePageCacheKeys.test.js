import { LIVE_PAGE_CACHE_KEYS } from './livePageCacheKeys';

describe('livePageCacheKeys', () => {
  it('exposes stable keys for live-market page cache policy', () => {
    expect(LIVE_PAGE_CACHE_KEYS.dashboard).toBe('dashboard_overview_cache_v15');
    expect(LIVE_PAGE_CACHE_KEYS.sectorOutlook).toBe('sectorOutlookData_v2');
    expect(LIVE_PAGE_CACHE_KEYS.fiiDii).toBe('marketOutlookFiiDii_v5');
    expect(LIVE_PAGE_CACHE_KEYS.liveSetups).toBe('liveSetupsEntryReady_v3');
    expect(LIVE_PAGE_CACHE_KEYS.chartFundamental).toBe('advisor_chart_fundamental_agent_v7');
    expect(LIVE_PAGE_CACHE_KEYS.trendReversal).toBe('advisor_trend_reversal_grid_v3');
    expect(LIVE_PAGE_CACHE_KEYS.trending(50)).toBe('trendingStocksData_v4_50');
  });

  it('keeps watchlist prefetch keys in sync with ST/LT pages (regression)', () => {
    // Bug: prefetch warmed shortTermWatchlist_v3 while pages read _v4 — the
    // login warm-up never hit. Pages now import these constants directly.
    expect(LIVE_PAGE_CACHE_KEYS.shortTermWatchlist).toBe('shortTermWatchlist_v5');
    expect(LIVE_PAGE_CACHE_KEYS.longTermWatchlist).toBe('longTermWatchlist_v5');
  });

  it('scopes volume shockers prefetch key by user like the page does (regression)', () => {
    // v6: invalidate v5 caches that held already-mapped rows (double-map → "—").
    expect(LIVE_PAGE_CACHE_KEYS.volumeShockers('u42', 'day', 50)).toBe('volumeShockersData_v6_u42_day_50');
    expect(LIVE_PAGE_CACHE_KEYS.volumeShockers(undefined, 'day', 50)).toBe('volumeShockersData_v6_default_day_50');
  });

  it('bumps price shockers key with limit so prefetch stores raw rows for pages', () => {
    expect(LIVE_PAGE_CACHE_KEYS.priceShockers('gainers', 'day', 50)).toBe('priceShockersData_v5_gainers_day_50');
    expect(LIVE_PAGE_CACHE_KEYS.priceShockers('all', 'day', 200)).toBe('priceShockersData_v5_all_day_200');
  });
});
