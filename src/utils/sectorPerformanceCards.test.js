import {
  buildSectorPerformanceCards,
  formatSectorCardSubtitle,
  sectorDayChangePct,
} from './sectorPerformanceCards';

describe('sectorPerformanceCards', () => {
  it('uses Sector Insights day1d for card % (not a separate stale source)', () => {
    // Regression: dashboard heatmap must show the same 1D as Sector Insights table.
    const cards = buildSectorPerformanceCards([
      { name: 'NIFTY REALTY', day1d: '↘ -2.13%', value: '₹850.00', trend: '↘' },
      { name: 'NIFTY PHARMA', day1d: '↗ 1.04%', value: '₹22,100.00', trend: '↗' },
      { name: 'NIFTY IT', day1d: '↘ -1.11%', value: '₹35,000.00', trend: '↘' },
    ]);
    expect(cards.map((c) => c.sector)).toEqual(['NIFTY REALTY', 'NIFTY IT', 'NIFTY PHARMA']);
    expect(cards[0].avg_day_change).toBeCloseTo(-2.13);
    expect(cards[1].avg_day_change).toBeCloseTo(-1.11);
    expect(cards[2].avg_day_change).toBeCloseTo(1.04);
  });

  it('prefers day1dNum / avg_day_change from normalizeRow', () => {
    expect(sectorDayChangePct({ day1dNum: -1.87, day1d: '↘ -9.99%' })).toBe(-1.87);
    expect(sectorDayChangePct({ avg_day_change: 0.55, day1d: '↗ 0.55%' })).toBe(0.55);
  });

  it('does not show "0 stocks" when stock_count is missing (show CMP instead)', () => {
    // Bug: Number(null) === 0 made every card say "0 stocks".
    const cards = buildSectorPerformanceCards([
      { sector: 'NIFTY BANK', day1dNum: -1.15, value: '₹52,000.00', stock_count: null },
    ]);
    expect(cards[0].stock_count).toBeNull();
    expect(formatSectorCardSubtitle(cards[0])).toBe('₹52,000.00');
    expect(formatSectorCardSubtitle({ stock_count: null, value: '—' })).toBe('—');
    expect(formatSectorCardSubtitle({ stock_count: 12, value: '₹1' })).toBe('12 stocks');
  });

  it('drops rows without a parseable 1D change', () => {
    expect(buildSectorPerformanceCards([
      { name: 'NIFTY AUTO', day1d: '—' },
      { name: 'NIFTY METAL', day1dNum: 0.55 },
    ])).toHaveLength(1);
  });
});
