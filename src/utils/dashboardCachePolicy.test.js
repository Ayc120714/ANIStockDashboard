import {
  applyLiveSessionRefreshPolicy,
  applyPullRefreshPolicy,
  buildDashboardRefreshFallback,
  dashboardSectionsToRefresh,
  hasDashboardIndices,
  hasDashboardMovers,
  hasDashboardWatchlist,
  isDashboardCacheIncomplete,
  pickDashboardSectionRows,
} from './dashboardCachePolicy';
import { hasDuplicateWeeklyEntrySymbols } from './weeklyEntries';

describe('dashboardCachePolicy', () => {
  it('refreshes alerts during live session even when extras cache looks complete', () => {
    const cached = {
      indices: { indexCards: [{ title: 'Nifty 50' }] },
      gainers: [{ symbol: 'A' }],
      losers: [{ symbol: 'B' }],
      watchlist: [{ symbol: 'Z' }],
      signals: [{ id: 1 }],
      weeklyData: [],
      alerts: [{ id: 1 }],
      ratings: [{ symbol: 'Z' }],
      trendingStocks: [{ symbol: 'T' }],
      sectors: [{ sector: 'IT' }],
      obData: [{ symbol: 'O' }],
    };
    const need = dashboardSectionsToRefresh(cached);
    expect(need.extras).toBe(false);

    applyLiveSessionRefreshPolicy(need, true);

    expect(need.extras).toBe(true);
    expect(need.indices).toBe(true);
    expect(need.movers).toBe(true);
  });

  it('treats web indices object as usable cache content', () => {
    const cached = {
      indices: { indexCards: [{ title: 'Nifty 50', value: '24000' }] },
      gainers: [{ symbol: 'A' }],
      losers: [{ symbol: 'B' }],
    };
    expect(hasDashboardIndices(cached)).toBe(true);
    expect(isDashboardCacheIncomplete(cached)).toBe(false);
    expect(dashboardSectionsToRefresh(cached).indices).toBe(false);
  });

  it('refetches weekly entries when cached rows contain duplicate symbols', () => {
    const cached = {
      indices: { indexCards: [{ title: 'Nifty 50' }] },
      gainers: [{ symbol: 'A' }],
      losers: [{ symbol: 'B' }],
      weeklyData: [
        { symbol: 'AADHARHFC', weekly_entry_gap_pct: 1.7 },
        { symbol: 'AADHARHFC', weekly_entry_gap_pct: 1.7 },
      ],
    };
    expect(hasDuplicateWeeklyEntrySymbols(cached.weeklyData)).toBe(true);
    expect(isDashboardCacheIncomplete(cached)).toBe(true);
  });

  it('watchlist alone makes cache complete', () => {
    const cached = { watchlist: [{ symbol: 'LT' }] };
    expect(hasDashboardWatchlist(cached)).toBe(true);
    expect(isDashboardCacheIncomplete(cached)).toBe(false);
  });

  it('requires both gainers and losers for complete movers cache', () => {
    expect(hasDashboardMovers({ gainers: [{ symbol: 'A' }], losers: [{ symbol: 'B' }] })).toBe(true);
    expect(hasDashboardMovers({ gainers: [{ symbol: 'A' }], losers: [] })).toBe(false);
    expect(dashboardSectionsToRefresh({ gainers: [{ symbol: 'A' }], losers: [] }).movers).toBe(true);
  });

  it('keeps cached rows when a fresh fetch returns empty', () => {
    const fallback = { gainers: [{ symbol: 'SAKSOFT' }] };
    expect(pickDashboardSectionRows('gainers', [], fallback)).toEqual([{ symbol: 'SAKSOFT' }]);
    expect(pickDashboardSectionRows('gainers', [{ symbol: 'NEW' }], fallback)).toEqual([{ symbol: 'NEW' }]);
  });

  it('unwraps wrapped page cache for refresh fallback', () => {
    const wrapped = { data: { gainers: [{ symbol: 'X' }] }, updatedAt: 1 };
    expect(buildDashboardRefreshFallback(wrapped)).toEqual({ gainers: [{ symbol: 'X' }] });
  });

  it('forces all sections on pull refresh', () => {
    const need = { indices: false, movers: false, watchlist: false, extras: false };
    applyPullRefreshPolicy(need);
    expect(need).toEqual({ indices: true, movers: true, watchlist: true, extras: true });
  });
});
