const mockFetchBuyTier = jest.fn();

jest.mock('@core/api/services/advisorService', () => ({
  advisorService: {
    fetchBuyTierCardGrid: (...args) => mockFetchBuyTier(...args),
  },
}));

jest.mock('@core/utils/safeFetch', () => ({
  safeFetch: jest.fn(async fn => fn()),
}));

import {fetchAdvisorTrendPayload, hasUsableAdvisorTrendPayload} from '@core/utils/advisorHubCache';
import {apiTrendEnvelope, buildTrendGrid, sampleTrendRow} from './fixtures/trendGridFixtures';

describe('fetchAdvisorTrendPayload v1.2.43', () => {
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
  });

  it('throws when API returns empty tier grid so empty shells are not cached', async () => {
    mockFetchBuyTier.mockResolvedValue(apiTrendEnvelope(buildTrendGrid()));

    await expect(fetchAdvisorTrendPayload()).rejects.toThrow(
      /No trend reversal matches available right now/,
    );
  });
});
