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
});
