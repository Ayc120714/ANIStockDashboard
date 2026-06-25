import {
  runScreenPayloadFetch,
  runScreenTableFetch,
  runWatchlistPageFetch,
} from './screenPageLoader';
import { writePageCache } from './pageDataCache';

jest.mock('./marketSession', () => ({
  ensureMarketSession: jest.fn(async () => ({ isLiveMarket: true, isTradingDay: true })),
  getCachedMarketSession: jest.fn(() => ({ isLiveMarket: true, isTradingDay: true })),
  getMarketPollingIntervalMs: jest.fn((liveMs) => liveMs),
  isPageCacheStale: jest.fn(() => false),
  shouldPollLiveMarket: jest.fn(() => true),
  shouldSkipNetworkForClosedMarket: jest.fn(() => false),
}));

jest.mock('../api/apiClient', () => ({
  clearApiGetCache: jest.fn(),
}));

describe('screenPageLoader live navigation', () => {
  beforeEach(() => {
    sessionStorage.clear();
    jest.clearAllMocks();
  });

  it('shows cached table rows immediately during live session without blocking spinner', async () => {
    const cacheKey = 'test_market_outlook_live_nav';
    writePageCache(cacheKey, {
      indexCards: [{ title: 'Nifty 50', value: '25,000' }],
      tableData: [{ name: 'Nifty 50' }],
      lastRefreshedAt: Date.now(),
    });

    const applyPayload = jest.fn();
    const fetcher = jest.fn(async () => ({
      indexCards: [{ title: 'Nifty 50', value: '25,100' }],
      tableData: [{ name: 'Nifty 50' }],
      lastRefreshedAt: Date.now(),
    }));
    const setLoading = jest.fn();

    await runScreenPayloadFetch({
      cacheKey,
      fetcher,
      applyPayload,
      setLoading,
      setError: jest.fn(),
      forceNetwork: false,
      hasUsable: (data) => Boolean(data?.indexCards?.length),
    });

    expect(applyPayload).toHaveBeenCalledWith(
      expect.objectContaining({ indexCards: [{ title: 'Nifty 50', value: '25,000' }] }),
    );
    expect(setLoading).toHaveBeenCalledWith(false);

    await new Promise((resolve) => { setTimeout(resolve, 10); });
    expect(fetcher).toHaveBeenCalled();
    expect(applyPayload.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('shows cached table rows immediately during live session without blocking spinner', async () => {
    const cacheKey = 'test_sector_live_nav';
    writePageCache(cacheKey, [{ name: 'IT', value: '100' }]);

    const setRows = jest.fn();
    const fetcher = jest.fn(async () => [{ name: 'IT', value: '101' }]);
    const setLoading = jest.fn();

    await runScreenTableFetch({
      cacheKey,
      fetcher,
      setRows,
      setLoading,
      setError: jest.fn(),
      forceNetwork: false,
    });

    expect(setRows).toHaveBeenCalledWith([{ name: 'IT', value: '100' }]);
    expect(setLoading).toHaveBeenCalledWith(false);

    await new Promise((resolve) => { setTimeout(resolve, 10); });
    expect(fetcher).toHaveBeenCalled();
  });

  it('does not hydrate sparse watchlist cache; fetches master data from API', async () => {
    const cacheKey = 'shortTermWatchlist_test';
    writePageCache(cacheKey, {
      watchlist: [{ symbol: 'HSCL' }],
      signals: [{ symbol: 'HSCL', rsi: 50 }],
    });
    const applyPayload = jest.fn();
    const fetcher = jest.fn(async () => ({
      watchlist: [{ symbol: 'HSCL', price: 95.5, day1d: 1.2, rsi: 55 }],
      signals: [],
    }));

    await runWatchlistPageFetch({
      cacheKey,
      fetcher,
      applyPayload,
      setLoading: jest.fn(),
      forceNetwork: false,
    });

    expect(applyPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        watchlist: [expect.objectContaining({ symbol: 'HSCL', price: 95.5 })],
      }),
    );
    expect(applyPayload).not.toHaveBeenCalledWith(
      expect.objectContaining({ watchlist: [{ symbol: 'HSCL' }] }),
    );
  });

  it('hydrates enriched watchlist pages from cache during live navigation', async () => {
    const cacheKey = 'shortTermWatchlist_test';
    writePageCache(cacheKey, {
      watchlist: [{ symbol: 'RELIANCE', price: 2500, day1d: 0.5 }],
      signals: [{ symbol: 'RELIANCE', signal: 'BUY' }],
    });
    const applyPayload = jest.fn();
    const fetcher = jest.fn(async () => ({
      watchlist: [{ symbol: 'TCS', price: 4000, day1d: 1.1 }],
      signals: [],
    }));

    await runWatchlistPageFetch({
      cacheKey,
      fetcher,
      applyPayload,
      setLoading: jest.fn(),
      forceNetwork: false,
    });

    expect(applyPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        watchlist: [expect.objectContaining({ symbol: 'RELIANCE', price: 2500 })],
      }),
    );
  });
});
