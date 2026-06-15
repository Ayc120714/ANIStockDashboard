import { applyLiveSessionRefreshPolicy, dashboardSectionsToRefresh } from './dashboardCachePolicy';

describe('dashboardCachePolicy', () => {
  it('refreshes alerts during live session even when extras cache looks complete', () => {
    const cached = {
      indices: { nifty: 1 },
      gainers: [{ symbol: 'A' }],
      losers: [{ symbol: 'B' }],
      watchlist: [],
      signals: [],
      weeklyData: [],
      alerts: [{ id: 1 }],
      ratings: [],
      trendingStocks: [],
      sectors: [],
      obData: [],
    };
    const need = dashboardSectionsToRefresh(cached);
    expect(need.extras).toBe(false);

    applyLiveSessionRefreshPolicy(need, true);

    expect(need.extras).toBe(true);
    expect(need.indices).toBe(true);
    expect(need.movers).toBe(true);
  });
});
