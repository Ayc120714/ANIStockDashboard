import {groupTrendReversalGridRows, flattenBuyTierGrid} from '@core/utils/buyTierGrid';
import {
  apiTrendEnvelope,
  buildTrendGrid,
  cachedTrendEnvelope,
  sampleTrendRow,
} from './fixtures/trendGridFixtures';

describe('buyTierGrid trend reversal table rows', () => {
  const grid = buildTrendGrid({
    weekly: {
      B1: [sampleTrendRow('RELIANCE', 'B1')],
      S2: [sampleTrendRow('ITC', 'S2')],
    },
  });

  it('groups weekly B1-S3 rows from raw grid', () => {
    const grouped = groupTrendReversalGridRows(grid, {timeframe: 'weekly'});
    expect(grouped.B1).toHaveLength(1);
    expect(grouped.B1[0].symbol).toBe('RELIANCE');
    expect(grouped.S2).toHaveLength(1);
    expect(grouped.B2).toHaveLength(0);
  });

  it('groups rows from API and cache envelopes', () => {
    const fromApi = groupTrendReversalGridRows(apiTrendEnvelope(grid), {timeframe: 'weekly'});
    const fromCache = groupTrendReversalGridRows(cachedTrendEnvelope(grid), {timeframe: 'weekly'});
    expect(fromApi.B1[0].symbol).toBe('RELIANCE');
    expect(fromCache.S2[0].symbol).toBe('ITC');
  });

  it('dedupes symbols within a tier', () => {
    const dupGrid = buildTrendGrid({
      daily: {B1: [sampleTrendRow('TCS', 'B1'), sampleTrendRow('TCS', 'B1')]},
    });
    const grouped = groupTrendReversalGridRows(dupGrid, {timeframe: 'daily'});
    expect(grouped.B1).toHaveLength(1);
  });

  it('flattens all tiers for a timeframe', () => {
    const rows = flattenBuyTierGrid(grid, {timeframe: 'weekly', tier: 'all'});
    expect(rows).toHaveLength(2);
    expect(rows.map(r => r.symbol).sort()).toEqual(['ITC', 'RELIANCE']);
  });
});
