import { buildChartAgentBlocks } from '@core/utils/chartFundamentalAgent';

describe('chartFundamentalAgent FII mapping', () => {
  it('includes FII 4Q display fields on mapped agent rows', () => {
    const blocks = buildChartAgentBlocks({
      data: [
        {
          symbol: 'RELIANCE',
          sector: 'Energy',
          close: 2500,
          rs_daily_123: 1.2,
          rating: 'strong_buy',
          horizon: 'long_term',
          fii_holding_quarters: [
            { period: 'Q4 FY25', pct: 14.2 },
            { period: 'Q3 FY25', pct: 13.8 },
            { period: 'Q2 FY25', pct: 13.8 },
            { period: 'Q1 FY25', pct: 12.95 },
          ],
        },
      ],
    });
    const daily = blocks.find((b) => b.id === 'daily');
    expect(daily.rows[0].fii4qLabel).toBe('14.20 ≥ 13.80 ≥ 13.80 ≥ 12.95');
    expect(daily.rows[0].fii4qSort).toBe(14.2);
  });
});
