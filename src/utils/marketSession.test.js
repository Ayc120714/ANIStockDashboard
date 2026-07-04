import { isPostMarketPageCacheStale, nseCloseEpochMsForDateIso } from './marketSession';

describe('nseCloseEpochMsForDateIso', () => {
  test('parses reference trading date to 15:30 IST epoch', () => {
    expect(nseCloseEpochMsForDateIso('2026-07-03')).toBe(
      Date.parse('2026-07-03T15:30:00+05:30'),
    );
  });
});

describe('isPostMarketPageCacheStale', () => {
  test('treats pre-open cache as stale on same IST day', () => {
    const session = { isTradingDay: true };
    // 07:00 IST same calendar day as cache written at 06:30 IST
    const cacheTs = Date.parse('2026-06-16T06:30:00+05:30');
    jest.useFakeTimers();
    jest.setSystemTime(Date.parse('2026-06-16T07:00:00+05:30'));
    expect(isPostMarketPageCacheStale(cacheTs, session)).toBe(true);
    jest.useRealTimers();
  });

  test('treats intraday weekend cache as stale vs Friday EOD reference', () => {
    const session = { isTradingDay: false, referenceTradingDate: '2026-07-03' };
    const fridayIntradayCache = Date.parse('2026-07-03T11:00:00+05:30');
    jest.useFakeTimers();
    jest.setSystemTime(Date.parse('2026-07-04T20:00:00+05:30')); // Saturday evening
    expect(isPostMarketPageCacheStale(fridayIntradayCache, session)).toBe(true);
    jest.useRealTimers();
  });

  test('keeps post-close weekend cache when written after reference session close', () => {
    const session = { isTradingDay: false, referenceTradingDate: '2026-07-03' };
    const fridayPostCloseCache = Date.parse('2026-07-03T16:05:00+05:30');
    jest.useFakeTimers();
    jest.setSystemTime(Date.parse('2026-07-04T20:00:00+05:30'));
    expect(isPostMarketPageCacheStale(fridayPostCloseCache, session)).toBe(false);
    jest.useRealTimers();
  });
});
