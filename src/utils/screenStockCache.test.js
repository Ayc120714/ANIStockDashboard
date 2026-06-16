import {
  LEGACY_FORMATTED_SCREEN_CACHE_PREFIXES,
  purgeLegacyFormattedScreenCaches,
} from './screenStockCache';

describe('screenStockCache', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  test('purges legacy formatted screen cache keys', () => {
    sessionStorage.setItem('trendingStocksData_v2_50', JSON.stringify({ data: [], updatedAt: 1 }));
    sessionStorage.setItem('relativePerformanceData_v2_1w_50', JSON.stringify({ data: [], updatedAt: 1 }));
    sessionStorage.setItem('trendingStocksData_v3_50', JSON.stringify({ data: [{ symbol: 'X' }], updatedAt: 1 }));
    purgeLegacyFormattedScreenCaches();
    expect(sessionStorage.getItem('trendingStocksData_v2_50')).toBeNull();
    expect(sessionStorage.getItem('relativePerformanceData_v2_1w_50')).toBeNull();
    expect(sessionStorage.getItem('trendingStocksData_v3_50')).not.toBeNull();
  });

  test('legacy prefix list covers all stock screen tables', () => {
    expect(LEGACY_FORMATTED_SCREEN_CACHE_PREFIXES).toEqual(
      expect.arrayContaining([
        'trendingStocksData_v2_',
        'relativePerformanceData_v2_',
        'priceShockersData_v3_',
        'volumeShockersData_v4_',
        'dashboard_overview_cache_v4',
      ]),
    );
  });
});
