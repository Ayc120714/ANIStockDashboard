import {
  isWatchlistRowEnriched,
  watchlistPayloadHasUsableMarketData,
} from './watchlistCachePolicy';

describe('watchlistCachePolicy', () => {
  it('rejects symbol-only optimistic stub rows (ST/LT dashes regression)', () => {
    expect(isWatchlistRowEnriched({ symbol: 'HSCL' })).toBe(false);
  });

  it('accepts rows with master-derived price or signal fields', () => {
    expect(isWatchlistRowEnriched({ symbol: 'HSCL', price: 42.5 })).toBe(true);
    expect(isWatchlistRowEnriched({ symbol: 'HSCL', rsi: 55.2 })).toBe(true);
    expect(isWatchlistRowEnriched({ symbol: 'HSCL', buy_sell_tier: 'B2' })).toBe(true);
  });

  it('watchlist payload unusable when any row lacks master fields', () => {
    const sparse = {
      watchlist: [{ symbol: 'HSCL' }],
      signals: [{ symbol: 'HSCL', rsi: 50 }],
    };
    expect(watchlistPayloadHasUsableMarketData(sparse)).toBe(false);
  });

  it('watchlist payload usable when all rows are enriched', () => {
    const enriched = {
      watchlist: [
        { symbol: 'HSCL', price: 100, day1d: 1.2 },
        { symbol: 'INFY', rsi: 48 },
      ],
      signals: [],
    };
    expect(watchlistPayloadHasUsableMarketData(enriched)).toBe(true);
  });
});
