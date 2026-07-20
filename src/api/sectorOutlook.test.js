/**
 * Lightweight normalize coverage — fetchSectorOutlook maps API rows for both
 * Sector Insights and Dashboard Sector Performance cards.
 */
import { fetchSectorOutlook } from './sectorOutlook';
import { apiGet } from './apiClient';

jest.mock('./apiClient', () => ({
  apiGet: jest.fn(),
}));

describe('fetchSectorOutlook normalizeRow', () => {
  beforeEach(() => {
    apiGet.mockReset();
  });

  it('parses trend-prefixed day1d and does not coerce missing stock_count to 0', async () => {
    // Regression: Number(null)===0 showed "0 stocks"; avg_day_change:0 faked flat days.
    apiGet.mockResolvedValue([
      {
        id: '01',
        name: 'NIFTY REALTY',
        trend: '↘',
        value: '₹850.00',
        percentile: '40%',
        day1d: '↘ -2.13%',
        week1w: '↘ -1.00%',
        month1m: '↗ 2.00%',
        month3m: '—',
        month6m: '—',
        year1y: '—',
        year3y: '—',
      },
    ]);

    const rows = await fetchSectorOutlook();
    expect(rows).toHaveLength(1);
    expect(rows[0].sector).toBe('NIFTY REALTY');
    expect(rows[0].day1dNum).toBeCloseTo(-2.13);
    expect(rows[0].avg_day_change).toBeCloseTo(-2.13);
    expect(rows[0].stock_count).toBeNull();
    expect(rows[0].value).toBe('₹850.00');
  });

  it('keeps explicit zero stock_count and zero day change', async () => {
    apiGet.mockResolvedValue([
      {
        name: 'NIFTY FLAT',
        day1d: '+0.00%',
        stock_count: 0,
        value: '₹100.00',
      },
    ]);
    const rows = await fetchSectorOutlook();
    expect(rows[0].avg_day_change).toBeCloseTo(0);
    expect(rows[0].stock_count).toBe(0);
  });
});
