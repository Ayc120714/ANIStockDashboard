import {
  clearAllSessionPageCaches,
  isSessionPageCacheKey,
  readPageCache,
  writePageCache,
} from './pageDataCache';

describe('pageDataCache session scope', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('identifies session page cache keys', () => {
    expect(isSessionPageCacheKey('marketOutlookData_v3')).toBe(true);
    expect(isSessionPageCacheKey('auth_access_token')).toBe(false);
  });

  it('clears all session page caches on logout', () => {
    writePageCache('marketOutlookData_v3', { indices: [] });
    writePageCache('sectorOutlookData', [{ name: 'IT' }]);
    sessionStorage.setItem('auth_user', '{"id":1}');
    expect(clearAllSessionPageCaches()).toBe(2);
    expect(readPageCache('marketOutlookData_v3')).toBeNull();
    expect(sessionStorage.getItem('auth_user')).toBe('{"id":1}');
  });
});
