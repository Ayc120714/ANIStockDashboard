import {cacheHasUsableData} from '@core/storage/pageCache';
import {
  apiTrendEnvelope,
  buildTrendGrid,
  cachedTrendEnvelope,
  sampleTrendRow,
} from './fixtures/trendGridFixtures';

describe('pageCache trend and dashboard usability fixes', () => {
  it('does not treat empty trend grid keys as usable cache', () => {
    const emptyGrid = buildTrendGrid();
    expect(cacheHasUsableData(emptyGrid)).toBe(false);
    expect(cacheHasUsableData(cachedTrendEnvelope(emptyGrid))).toBe(false);
    expect(cacheHasUsableData(apiTrendEnvelope(emptyGrid))).toBe(false);
  });

  it('treats populated trend grid cache as usable', () => {
    const grid = buildTrendGrid({
      daily: {B1: [sampleTrendRow('RELIANCE', 'B1')]},
    });
    expect(cacheHasUsableData(cachedTrendEnvelope(grid))).toBe(true);
    expect(cacheHasUsableData(apiTrendEnvelope(grid))).toBe(true);
  });

  it('detects dashboard slices with gainers or losers as usable cache entries', () => {
    expect(cacheHasUsableData({gainers: [{symbol: 'A'}], losers: []})).toBe(true);
    expect(cacheHasUsableData({gainers: [], losers: [{symbol: 'B'}]})).toBe(true);
    expect(
      cacheHasUsableData({
        gainers: [{symbol: 'A'}],
        losers: [{symbol: 'B'}],
      }),
    ).toBe(true);
  });

  it('requires non-empty watchlist arrays', () => {
    expect(cacheHasUsableData({watchlist: []})).toBe(false);
    expect(cacheHasUsableData({watchlist: [{symbol: 'RELIANCE'}]})).toBe(true);
  });
});
