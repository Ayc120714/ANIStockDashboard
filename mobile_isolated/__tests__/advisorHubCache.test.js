import {
  countTrendGridRows,
  extractTrendGrid,
  hasTrendGridRows,
  hasUsableAdvisorTrendPayload,
  hasUsableAdvisorChartPayload,
  normalizeTrendGrid,
} from '@core/utils/advisorHubCache';
import {
  apiTrendEnvelope,
  buildTrendGrid,
  cachedTrendEnvelope,
  sampleTrendRow,
} from './fixtures/trendGridFixtures';

describe('advisorHubCache trend reversal fixes', () => {
  const populatedGrid = buildTrendGrid({
    daily: {B1: [sampleTrendRow('RELIANCE', 'B1')], B2: [sampleTrendRow('TCS', 'B2')]},
    weekly: {B3: [sampleTrendRow('INFY', 'B3')]},
    monthly: {S1: [sampleTrendRow('HDFCBANK', 'S1')]},
  });

  it('unwraps raw API envelope { screen, data: grid }', () => {
    const grid = normalizeTrendGrid(apiTrendEnvelope(populatedGrid));
    expect(grid?.daily?.B1?.count).toBe(1);
    expect(grid?.weekly?.B3?.count).toBe(1);
  });

  it('unwraps cached { trendGrid } envelope', () => {
    const grid = normalizeTrendGrid(cachedTrendEnvelope(populatedGrid));
    expect(countTrendGridRows(grid)).toBe(4);
  });

  it('unwraps doubly nested cache payloads', () => {
    const nested = {payload: {result: {trendGrid: populatedGrid}}};
    expect(normalizeTrendGrid(nested)).toEqual(populatedGrid);
  });

  it('extractTrendGrid is an alias for normalizeTrendGrid', () => {
    expect(extractTrendGrid(apiTrendEnvelope(populatedGrid))).toEqual(populatedGrid);
  });

  it('counts rows across daily, weekly, and monthly tiers', () => {
    expect(countTrendGridRows(populatedGrid)).toBe(4);
    expect(countTrendGridRows(apiTrendEnvelope(populatedGrid))).toBe(4);
    expect(countTrendGridRows(cachedTrendEnvelope(populatedGrid))).toBe(4);
  });

  it('rejects empty grid structure without items for row-based checks', () => {
    const emptyGrid = buildTrendGrid();
    expect(countTrendGridRows(emptyGrid)).toBe(0);
    expect(hasTrendGridRows(emptyGrid)).toBe(false);
    expect(hasUsableAdvisorTrendPayload(emptyGrid)).toBe(true);
    expect(hasUsableAdvisorTrendPayload(apiTrendEnvelope(emptyGrid))).toBe(true);
    expect(hasUsableAdvisorTrendPayload(cachedTrendEnvelope(emptyGrid))).toBe(true);
  });

  it('accepts populated trend payloads for cache hydration', () => {
    expect(hasUsableAdvisorTrendPayload(cachedTrendEnvelope(populatedGrid))).toBe(true);
  });

  it('supports array tier blocks from alternate API shapes', () => {
    const arrayGrid = {
      daily: {
        B1: [sampleTrendRow('SBIN', 'B1')],
        B2: [],
        B3: [],
        S1: [],
        S2: [],
        S3: [],
      },
      weekly: {},
      monthly: {},
    };
    expect(countTrendGridRows(arrayGrid)).toBe(1);
  });
});

describe('hasUsableAdvisorChartPayload cache poisoning guard', () => {
  it('rejects scanned chart payloads with all-empty setup tables', () => {
    // Regression: caching "0 matches" as usable pinned empty Daily/Weekly/
    // Monthly tables because closed-market loads skip the network.
    expect(
      hasUsableAdvisorChartPayload({
        agent: 'chart_fundamental',
        data: [],
        weekly_data: [],
        monthly_data: [],
        scan_symbols: 800,
      }),
    ).toBe(false);
  });

  it('accepts chart payloads when any setup table has rows', () => {
    expect(
      hasUsableAdvisorChartPayload({
        agent: 'chart_fundamental',
        data: [{symbol: 'HIRECT', close: 100, rs_daily_123: 0.42}],
        weekly_data: [],
        monthly_data: [],
        scan_symbols: 800,
      }),
    ).toBe(true);
  });
});
