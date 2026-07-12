const mockApiPost = jest.fn();
const mockApiRequest = jest.fn();
const mockClearPageCache = jest.fn();

jest.mock('@core/api/apiClient', () => ({
  apiPost: (...args) => mockApiPost(...args),
  apiRequest: (...args) => mockApiRequest(...args),
}));

jest.mock('@core/storage/pageCache', () => ({
  clearPageCache: (...args) => mockClearPageCache(...args),
}));

import {normalizeWatchlistSymbol, watchlistService} from '@core/api/services/watchlistService';

describe('watchlistService', () => {
  beforeEach(() => {
    mockApiPost.mockReset();
    mockApiRequest.mockReset();
    mockClearPageCache.mockReset();
    mockApiPost.mockResolvedValue({ok: true});
    mockApiRequest.mockResolvedValue({ok: true});
    mockClearPageCache.mockResolvedValue(undefined);
  });

  it('normalizes symbols to uppercase', () => {
    expect(normalizeWatchlistSymbol(' reliance ')).toBe('RELIANCE');
  });

  it('posts add with list_type for long term watchlist', async () => {
    await watchlistService.addToWatchlist('tcs', 'long_term');
    expect(mockApiPost).toHaveBeenCalledWith(
      '/watchlist',
      {symbol: 'TCS', list_type: 'long_term', notes: ''},
      expect.objectContaining({timeoutMs: expect.any(Number)}),
    );
    expect(mockClearPageCache).toHaveBeenCalled();
  });

  it('deletes symbol from short term watchlist', async () => {
    await watchlistService.removeFromWatchlist('infy', 'short_term');
    expect(mockApiRequest).toHaveBeenCalledWith(
      '/watchlist/symbol/INFY?list_type=short_term',
      expect.objectContaining({method: 'DELETE'}),
    );
  });

  it('invalidates dashboard page cache on watchlist mutations (regression)', async () => {
    // Bug: dashboard watchlist strip kept pre-mutation symbols until TTL expiry.
    const {MOBILE_PAGE_CACHE_KEYS} = require('@core/utils/dashboardCachePolicy');

    await watchlistService.addToWatchlist('tcs', 'long_term');
    expect(mockClearPageCache).toHaveBeenCalledWith(MOBILE_PAGE_CACHE_KEYS.watchlist('long_term'));
    expect(mockClearPageCache).toHaveBeenCalledWith(MOBILE_PAGE_CACHE_KEYS.dashboard);

    mockClearPageCache.mockClear();
    await watchlistService.removeFromWatchlist('infy', 'short_term');
    expect(mockClearPageCache).toHaveBeenCalledWith(MOBILE_PAGE_CACHE_KEYS.dashboard);

    mockClearPageCache.mockClear();
    await watchlistService.bulkDeleteFromWatchlist(['tcs'], 'long_term');
    expect(mockClearPageCache).toHaveBeenCalledWith(MOBILE_PAGE_CACHE_KEYS.dashboard);
  });
});
