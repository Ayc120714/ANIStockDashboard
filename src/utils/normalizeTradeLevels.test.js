import {
  normalizeTradeLevels,
  normalizeWatchlistTradeLevels,
} from '../utils/normalizeTradeLevels';

describe('normalizeTradeLevels (web/mobile ST parity)', () => {
  it('repairs wrong-side SL and targets for long setups', () => {
    const row = normalizeTradeLevels({
      symbol: 'RELIANCE',
      price: 100,
      entry_price: 100,
      buy_sell_tier: 'B1',
      stop_loss: 150,
      target_short_term: 80,
    });
    expect(row.stop_loss).toBeLessThan(100);
    expect(row.target_short_term).toBeGreaterThan(100);
    expect(row.target_1).toBe(row.target_short_term);
  });

  it('only applies to short_term watchlist lists', () => {
    const rows = [{symbol: 'X', price: 10, stop_loss: 999}];
    expect(normalizeWatchlistTradeLevels(rows, 'long_term')[0].stop_loss).toBe(999);
    expect(normalizeWatchlistTradeLevels(rows, 'short_term')[0].stop_loss).toBeLessThan(10);
  });
});
