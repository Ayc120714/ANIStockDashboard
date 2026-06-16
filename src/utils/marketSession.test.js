import { isPostMarketPageCacheStale } from './marketSession';

describe('isPostMarketPageCacheStale', () => {
  test('treats pre-open cache as stale on same IST day', () => {
    const session = { isTradingDay: true };
    // 07:00 IST same calendar day as cache written at 06:30 IST
    const cacheTs = Date.parse('2026-06-16T06:30:00+05:30');
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-06-16T07:00:00+05:30'));
    expect(isPostMarketPageCacheStale(cacheTs, session)).toBe(true);
    Date.now.mockRestore();
  });
});
