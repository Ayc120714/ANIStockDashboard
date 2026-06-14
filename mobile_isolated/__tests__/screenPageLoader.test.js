import {
  SCREEN_LIVE_POLL_MS,
  runScreenPayloadFetch,
  shouldRefreshPageCache,
} from '@core/utils/screenPageLoader';
import {writePageCache} from '@core/storage/pageCache';
import {MOBILE_PAGE_CACHE_KEYS} from '@core/utils/dashboardCachePolicy';
import {
  buildTrendGrid,
  cachedTrendEnvelope,
  sampleTrendRow,
} from './fixtures/trendGridFixtures';

jest.mock('@core/utils/marketSession', () => ({
  ensureMarketSession: jest.fn(async () => ({isLiveMarket: true, isTradingDay: true})),
  getCachedMarketSession: jest.fn(() => ({isLiveMarket: true, isTradingDay: true})),
  getMarketPollingIntervalMs: jest.fn((liveMs, closedMs) => liveMs),
  isPageCacheStale: jest.fn(() => true),
  shouldPollLiveMarket: jest.fn(session => Boolean(session?.isLiveMarket)),
  shouldSkipNetworkForClosedMarket: jest.fn(() => false),
}));

describe('screenPageLoader live polling fixes', () => {
  it('exposes 30s live poll interval constant', () => {
    expect(SCREEN_LIVE_POLL_MS).toBe(30_000);
  });

  it('refetches trend payload when cache has empty grid structure', async () => {
    const cacheKey = '@ani/test/trend-empty';
    const emptyGrid = buildTrendGrid();
    await writePageCache(cacheKey, cachedTrendEnvelope(emptyGrid));

    const applyPayload = jest.fn();
    const fetcher = jest.fn(async () =>
      cachedTrendEnvelope(
        buildTrendGrid({
          daily: {B1: [sampleTrendRow('RELIANCE', 'B1')]},
        }),
      ),
    );

    await runScreenPayloadFetch({
      cacheKey,
      fetcher,
      applyPayload,
      setLoading: jest.fn(),
      setError: jest.fn(),
      forceNetwork: true,
      hasUsable: data => data?.trendGrid?.daily?.B1?.count > 0,
    });

    expect(fetcher).toHaveBeenCalled();
    expect(applyPayload).toHaveBeenCalled();
  });

  it('marks stale cache for refresh during live session', async () => {
    const cacheKey = MOBILE_PAGE_CACHE_KEYS.stocksOutlook('market');
    await writePageCache(cacheKey, {
      indices: [{name: 'NIFTY'}],
      fii: null,
      sectorRows: [],
      grouped: null,
      updatedAt: Date.now() - 120_000,
    });

    const stale = await shouldRefreshPageCache(cacheKey);
    expect(stale).toBe(true);
  });
});
