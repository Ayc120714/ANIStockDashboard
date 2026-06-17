const mockFetchBuyTier = jest.fn();

jest.mock('@core/api/services/advisorService', () => ({
  advisorService: {
    fetchBuyTierCardGrid: (...args) => mockFetchBuyTier(...args),
  },
}));

import {fetchAdvisorTrendPayload, hasUsableAdvisorTrendPayload} from '@core/utils/advisorHubCache';
import {apiTrendEnvelope, buildTrendGrid, sampleTrendRow} from './fixtures/trendGridFixtures';

describe('fetchAdvisorTrendPayload', () => {
  beforeEach(() => {
    mockFetchBuyTier.mockReset();
  });

  it('returns raw grid (web TrendReversalTab cache shape), not { trendGrid } wrapper', async () => {
    const grid = buildTrendGrid({
      daily: {B1: [sampleTrendRow('RELIANCE', 'B1')]},
    });
    mockFetchBuyTier.mockResolvedValue(apiTrendEnvelope(grid));

    const result = await fetchAdvisorTrendPayload();

    expect(result.daily.B1.count).toBe(1);
    expect(result.trendGrid).toBeUndefined();
    expect(hasUsableAdvisorTrendPayload(result)).toBe(true);
    expect(mockFetchBuyTier).toHaveBeenCalledWith(
      expect.objectContaining({symbol_limit: 800, timeoutMs: 120_000}),
    );
  });

  it('returns empty grid structure without throwing (web parity)', async () => {
    const empty = buildTrendGrid();
    mockFetchBuyTier.mockResolvedValue(apiTrendEnvelope(empty));

    const result = await fetchAdvisorTrendPayload();

    expect(result.daily.B1.count).toBe(0);
    expect(hasUsableAdvisorTrendPayload(result)).toBe(true);
  });

  it('throws when API envelope cannot be parsed into a grid', async () => {
    mockFetchBuyTier.mockResolvedValue({screen: 'buy_tier_card_grid', data: null});

    await expect(fetchAdvisorTrendPayload()).rejects.toThrow(/invalid/i);
  });
});
