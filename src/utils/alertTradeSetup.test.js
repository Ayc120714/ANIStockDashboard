import {
  buildProductProfilesFromAlertDetail,
  canShowAlertTradeActions,
  inferAlertSide,
  productOptionsForSide,
} from './alertTradeSetup';

describe('alertTradeSetup', () => {
  const detail = {
    symbol: 'RELIANCE',
    isEntryReady: true,
    hasTradeLevels: true,
    levels: {
      entry: 2850,
      stopLoss: 2780,
      target1: 2950,
      target2: 3020,
    },
    raw: { alert_type: 'ENTRY_READY', trend: 'bullish' },
  };

  it('builds MIS/MTF/Delivery product profiles from alert levels', () => {
    const profile = buildProductProfilesFromAlertDetail(detail);
    expect(profile.byProduct.INTRADAY.entryPrice).toBe(2850);
    expect(profile.byProduct.INTRADAY.stopLoss).toBe(2780);
    expect(profile.byProduct.MARGIN.entryPrice).toBe(2850);
    expect(profile.byProduct.DELIVERY.target1).toBeGreaterThan(0);
  });

  it('infers buy side for bullish entry-ready alerts', () => {
    expect(inferAlertSide(detail)).toBe('BUY');
  });

  it('hides MTF for sell side product options', () => {
    const opts = productOptionsForSide('SELL');
    expect(opts.map((o) => o.value)).toEqual(['INTRADAY', 'DELIVERY']);
  });

  it('allows trade actions when entry-ready alert has levels', () => {
    expect(canShowAlertTradeActions(detail)).toBe(true);
  });
});
