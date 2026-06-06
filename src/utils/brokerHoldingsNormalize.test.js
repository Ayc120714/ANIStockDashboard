import { ensureNormalizedBrokerRows, normalizeBrokerRows } from './brokerHoldingsNormalize';

describe('brokerHoldingsNormalize', () => {
  test('normalizes raw Dhan holdings rows', () => {
    const rows = normalizeBrokerRows([
      {
        tradingSymbol: 'RELIANCE',
        totalQty: 10,
        avgCostPrice: 2500,
        lastTradedPrice: 2550,
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      symbol: 'RELIANCE',
      net_qty: 10,
      avg_price: 2500,
      ltp: 2550,
      product_type: 'DELIVERY',
    });
  });

  test('re-normalizes cached raw rows with netQty/tradingSymbol', () => {
    const cached = [
      { tradingSymbol: 'TCS', netQty: 5, buyAvg: 3500, ltp: 3600, productType: 'INTRADAY' },
    ];
    const rows = ensureNormalizedBrokerRows(cached);
    expect(rows[0].symbol).toBe('TCS');
    expect(rows[0].net_qty).toBe(5);
  });

  test('passes through already-normalized rows', () => {
    const normalized = [
      { symbol: 'INFY', net_qty: 20, avg_price: 1500, ltp: 1520, unrealized_pnl: 400, product_type: 'DELIVERY' },
    ];
    expect(ensureNormalizedBrokerRows(normalized)).toEqual(normalized);
  });

  test('prefers holdings/positions over order reconstruction', () => {
    const holdings = normalizeBrokerRows([{ tradingSymbol: 'LT', totalQty: 1, avgCostPrice: 100 }]);
    const orders = [
      { tradingSymbol: 'NTPCGREEN', orderStatus: 'FILLED', transactionType: 'BUY', quantity: 5000, averagePrice: 98 },
    ];
    expect(holdings[0].symbol).toBe('LT');
    expect(holdings).toHaveLength(1);
    expect(orders[0].tradingSymbol).toBe('NTPCGREEN');
  });
});
