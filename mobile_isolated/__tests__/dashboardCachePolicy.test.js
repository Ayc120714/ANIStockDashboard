import {
  applyLiveSessionRefreshPolicy,
  applyPullRefreshPolicy,
  dashboardSectionsToRefresh,
  LEGACY_ADVISOR_TREND_CACHE_KEYS,
  LEGACY_DASHBOARD_CACHE_KEYS,
  MOBILE_PAGE_CACHE_KEYS,
  hasDashboardMovers,
  isDashboardCacheIncomplete,
  shouldForceAdvisorTrendNetwork,
  shouldRefreshAdvisorTrendCache,
} from '@core/utils/dashboardCachePolicy';

describe('dashboard cache policy fixes', () => {
  it('uses bumped cache keys for dashboard and trend reversal', () => {
    expect(MOBILE_PAGE_CACHE_KEYS.dashboard).toBe('@ani/mobile/page-cache/dashboard-v16');
    expect(MOBILE_PAGE_CACHE_KEYS.advisorSignals).toBe('@ani/mobile/page-cache/advisor-signals-v5');
    expect(MOBILE_PAGE_CACHE_KEYS.advisorHubTrend).toBe(
      '@ani/mobile/page-cache/advisor-hub-trend-v10',
    );
    expect(MOBILE_PAGE_CACHE_KEYS.stocksOutlook('market')).toContain('stocks-outlook-v4');
    expect(MOBILE_PAGE_CACHE_KEYS.screensHub('movers', 'gainers', 'day', 'day', 'short')).toContain(
      'screens-v5',
    );
  });

  it('tracks legacy dashboard cache keys for upgrade cleanup', () => {
    expect(LEGACY_DASHBOARD_CACHE_KEYS).toContain('@ani/mobile/page-cache/dashboard-v15');
    expect(LEGACY_DASHBOARD_CACHE_KEYS).not.toContain(MOBILE_PAGE_CACHE_KEYS.dashboard);
  });

  it('tracks legacy trend cache keys for upgrade cleanup', () => {
    expect(LEGACY_ADVISOR_TREND_CACHE_KEYS).toEqual([
      '@ani/mobile/page-cache/advisor-hub-trend-v4',
      '@ani/mobile/page-cache/advisor-hub-trend-v5',
      '@ani/mobile/page-cache/advisor-hub-trend-v6',
      '@ani/mobile/page-cache/advisor-hub-trend-v7',
      '@ani/mobile/page-cache/advisor-hub-trend-v8',
      '@ani/mobile/page-cache/advisor-hub-trend-v9',
    ]);
    expect(LEGACY_ADVISOR_TREND_CACHE_KEYS).not.toContain(MOBILE_PAGE_CACHE_KEYS.advisorHubTrend);
  });

  it('requires both gainers and losers for dashboard movers', () => {
    expect(hasDashboardMovers({gainers: [{symbol: 'A'}], losers: []})).toBe(false);
    expect(hasDashboardMovers({gainers: [], losers: [{symbol: 'B'}]})).toBe(false);
    expect(
      hasDashboardMovers({
        gainers: [{symbol: 'A'}],
        losers: [{symbol: 'B'}],
      }),
    ).toBe(true);
  });

  it('flags incomplete dashboard cache when movers are partial', () => {
    expect(
      isDashboardCacheIncomplete({
        indices: [{name: 'NIFTY'}],
        gainers: [{symbol: 'A'}],
        losers: [],
      }),
    ).toBe(true);
    expect(
      isDashboardCacheIncomplete({
        indices: [{name: 'NIFTY'}],
        gainers: [{symbol: 'A'}],
        losers: [{symbol: 'B'}],
      }),
    ).toBe(false);
  });

  it('detects which dashboard sections need refresh from partial cache', () => {
    const partial = {
      indices: [{name: 'NIFTY'}],
      gainers: [{symbol: 'A'}],
      losers: [{symbol: 'B'}],
      watchlist: [{symbol: 'RELIANCE'}],
      signals: [{symbol: 'TCS'}],
    };
    const need = dashboardSectionsToRefresh(partial);
    expect(need.indices).toBe(false);
    expect(need.movers).toBe(false);
    expect(need.watchlist).toBe(false);
    expect(need.signals).toBe(false);
  });

  it('live session policy forces movers refresh even when cache looks complete', () => {
    const cached = {
      indices: [{name: 'NIFTY'}],
      gainers: [{symbol: 'A'}],
      losers: [{symbol: 'B'}],
      watchlist: [{symbol: 'RELIANCE'}],
      signals: [{symbol: 'TCS'}],
      alerts: [{id: 1}],
      ratings: [{symbol: 'INFY'}],
      trending: [{symbol: 'HDFC'}],
    };
    const need = dashboardSectionsToRefresh(cached);
    expect(need.movers).toBe(false);
    expect(need.extras).toBe(false);

    applyLiveSessionRefreshPolicy(need, true);

    expect(need.movers).toBe(true);
    expect(need.indices).toBe(true);
    expect(need.watchlist).toBe(true);
    expect(need.signals).toBe(true);
    expect(need.extras).toBe(true);
  });

  it('pull refresh policy defers heavy dashboard sections so spinner clears faster', () => {
    const need = {
      indices: true,
      movers: true,
      watchlist: true,
      signals: true,
      weekly: true,
      extras: true,
      optional: true,
    };
    applyPullRefreshPolicy(need);
    expect(need.indices).toBe(true);
    expect(need.movers).toBe(true);
    expect(need.watchlist).toBe(true);
    expect(need.signals).toBe(true);
    expect(need.weekly).toBe(false);
    expect(need.extras).toBe(false);
    expect(need.optional).toBe(false);
  });

  it('does not refetch trend tab when grid has data but daily timeframe is empty (v1.2.43)', () => {
    expect(shouldRefreshAdvisorTrendCache({stale: false, trendHasData: true})).toBe(false);
  });

  it('refetches trend tab when grid is missing or cache is stale', () => {
    expect(shouldRefreshAdvisorTrendCache({stale: false, trendHasData: false})).toBe(true);
    expect(shouldRefreshAdvisorTrendCache({stale: true, trendHasData: true})).toBe(true);
    expect(shouldForceAdvisorTrendNetwork({stale: false, trendHasData: false})).toBe(true);
    expect(shouldForceAdvisorTrendNetwork({stale: true, trendHasData: true})).toBe(true);
    expect(shouldForceAdvisorTrendNetwork({stale: false, trendHasData: true})).toBe(false);
  });
});
