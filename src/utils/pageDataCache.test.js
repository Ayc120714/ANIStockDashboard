import {
  chartFundamentalPayloadUsable,
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

describe('chartFundamentalPayloadUsable', () => {
  it('rejects empty-universe cached payloads', () => {
    expect(
      chartFundamentalPayloadUsable({
        agent: 'chart_fundamental',
        data: [],
        weekly_data: [],
        monthly_data: [],
        scan_symbols: 0,
      }),
    ).toBe(false);
  });

  it('accepts scanned payloads even when all gate tables are empty', () => {
    expect(
      chartFundamentalPayloadUsable({
        agent: 'chart_fundamental',
        data: [],
        weekly_data: [],
        monthly_data: [],
        scan_symbols: 800,
      }),
    ).toBe(true);
  });
});
