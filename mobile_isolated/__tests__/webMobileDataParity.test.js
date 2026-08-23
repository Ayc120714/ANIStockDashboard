import {
  ADVISOR_WEB_LIMITS,
  MOBILE_ADVISOR_LIMITS,
  MOBILE_ALERTS_LIMIT,
  MOBILE_MOVERS_LIMIT,
  MOBILE_SCREEN_LIST_LIMIT,
  MOBILE_SIGNALS_TAB_LIMIT,
} from '@core/utils/advisorWebParity';
import {formatPct} from '@core/utils/stockListPayload';
import {normalizeSectorOutlookRow} from '@core/utils/outlookPayload';
import {
  normalizeTradeLevels,
  normalizeWatchlistTradeLevels,
} from '@core/utils/normalizeTradeLevels';

describe('web/mobile data parity guards', () => {
  it('uses web-sized screen and movers limits (regression: movers defaulted to 8)', () => {
    expect(MOBILE_SCREEN_LIST_LIMIT).toBe(50);
    expect(MOBILE_MOVERS_LIMIT).toBe(200);
    expect(MOBILE_SIGNALS_TAB_LIMIT).toBe(120);
    expect(MOBILE_ALERTS_LIMIT).toBe(120);
  });

  it('aligns mobile advisor hub limits with web advisor limits', () => {
    expect(MOBILE_ADVISOR_LIMITS).toEqual(ADVISOR_WEB_LIMITS);
    expect(MOBILE_ADVISOR_LIMITS.latestSignals).toBe(250);
    expect(MOBILE_ADVISOR_LIMITS.customRs).toBe(500);
  });

  it('formats zero percent with a plus sign like web DashboardPage', () => {
    expect(formatPct(0)).toBe('+0.00%');
    expect(formatPct(1.5)).toBe('+1.50%');
    expect(formatPct(-2.25)).toBe('-2.25%');
  });

  it('preserves stock_count on sector outlook rows (web parity)', () => {
    const row = normalizeSectorOutlookRow({
      sector: 'IT',
      avg_day_change: 1.2,
      stock_count: 42,
      value: 100,
    });
    expect(row.stock_count).toBe(42);
    expect(normalizeSectorOutlookRow({sector: 'Bank', day1d: '+0.50%'}).stock_count).toBeNull();
  });

  it('normalizes short-term SL/target like web ShortTermPage', () => {
    const badSl = normalizeTradeLevels({
      symbol: 'AAA',
      price: 100,
      entry_price: 100,
      buy_sell_tier: 'B1',
      stop_loss: 150, // wrong side for long
      target_short_term: 90, // wrong side
    });
    expect(badSl.stop_loss).toBeLessThan(100);
    expect(badSl.target_short_term).toBeGreaterThan(100);

    const longTermUnchanged = normalizeWatchlistTradeLevels(
      [{symbol: 'BBB', price: 50, stop_loss: 999}],
      'long_term',
    );
    expect(longTermUnchanged[0].stop_loss).toBe(999);

    const shortTermFixed = normalizeWatchlistTradeLevels(
      [{symbol: 'CCC', price: 200, entry_price: 200, buy_sell_tier: 'B2', stop_loss: null}],
      'short_term',
    );
    expect(shortTermFixed[0].stop_loss).toBeLessThan(200);
    expect(shortTermFixed[0].target_short_term).toBeGreaterThan(200);
  });
});
