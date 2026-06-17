const mockClearApiGetCache = jest.fn();
const mockFetchAdminUsers = jest.fn();
const mockApiPost = jest.fn();
const mockApiRequest = jest.fn();

jest.mock('../api/apiClient', () => ({
  clearApiGetCache: (...args) => mockClearApiGetCache(...args),
  apiGet: jest.fn(),
  apiPost: (...args) => mockApiPost(...args),
  apiRequest: (...args) => mockApiRequest(...args),
}));

jest.mock('../api/auth', () => ({
  fetchAdminUsers: (...args) => mockFetchAdminUsers(...args),
}));

import { addToWatchlist, removeFromWatchlist } from '../api/watchlist';
import { fetchFreshAdminUsers } from '../utils/adminUsersReload';

describe('mutation cache invalidation (web regression)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchAdminUsers.mockResolvedValue({ data: [] });
    mockApiPost.mockResolvedValue({ ok: true });
    mockApiRequest.mockResolvedValue({ ok: true });
  });

  it('fetchFreshAdminUsers clears GET cache and skips cache on admin users', async () => {
    await fetchFreshAdminUsers(true);
    expect(mockClearApiGetCache).toHaveBeenCalled();
    expect(mockFetchAdminUsers).toHaveBeenCalledWith(true, { skipCache: true });
  });

  it('addToWatchlist clears GET cache after POST', async () => {
    await addToWatchlist('TCS', 'long_term');
    expect(mockClearApiGetCache).toHaveBeenCalled();
  });

  it('removeFromWatchlist clears GET cache after DELETE', async () => {
    await removeFromWatchlist('INFY', 'short_term');
    expect(mockClearApiGetCache).toHaveBeenCalled();
  });
});
