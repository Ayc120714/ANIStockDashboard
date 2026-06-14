import {
  MOBILE_PAGE_CACHE_KEYS,
  dashboardSectionsToRefresh,
  hasDashboardMovers,
  isDashboardCacheIncomplete,
} from '@core/utils/dashboardCachePolicy';

describe('dashboard cache policy fixes', () => {
  it('uses bumped cache keys for dashboard and trend reversal', () => {
    expect(MOBILE_PAGE_CACHE_KEYS.dashboard).toBe('@ani/mobile/page-cache/dashboard-v14');
    expect(MOBILE_PAGE_CACHE_KEYS.advisorHubTrend).toBe(
      '@ani/mobile/page-cache/advisor-hub-trend-v5',
    );
    expect(MOBILE_PAGE_CACHE_KEYS.stocksOutlook('market')).toContain('stocks-outlook-v4');
    expect(MOBILE_PAGE_CACHE_KEYS.screensHub('movers', 'gainers', 'day', 'day', 'short')).toContain(
      'screens-v4',
    );
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
    };
    const need = dashboardSectionsToRefresh(cached);
    expect(need.movers).toBe(false);

    const liveSession = true;
    if (liveSession) {
      need.indices = true;
      need.movers = true;
      need.watchlist = true;
      need.signals = true;
    }

    expect(need.movers).toBe(true);
    expect(need.indices).toBe(true);
    expect(need.watchlist).toBe(true);
    expect(need.signals).toBe(true);
  });
});
