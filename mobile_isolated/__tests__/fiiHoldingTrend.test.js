import {
  buildFiiHoldingTooltip,
  formatFiiHoldingChain,
  getLatestFiiHoldingPct,
  mapFiiHoldingFields,
  normalizeFiiHoldingQuarters,
  normalizeFiiPct,
} from '@core/utils/fiiHoldingTrend';

describe('fiiHoldingTrend', () => {
  const sampleRow = {
    fii_holding_pct: 14.2,
    fii_holding_trend_ok: true,
    fii_holding_quarters: [
      { period: 'Q4 FY25', pct: 14.2 },
      { period: 'Q3 FY25', pct: 13.8 },
      { period: 'Q2 FY25', pct: 13.8 },
      { period: 'Q1 FY25', pct: 12.95 },
    ],
  };

  it('normalizes fractional and percent FII values', () => {
    expect(normalizeFiiPct(0.142)).toBeCloseTo(14.2, 4);
    expect(normalizeFiiPct(14.2)).toBe(14.2);
    expect(normalizeFiiPct(null)).toBeNull();
  });

  it('formats four-quarter chain newest-to-oldest', () => {
    expect(formatFiiHoldingChain(sampleRow)).toBe('14.20 ≥ 13.80 ≥ 13.80 ≥ 12.95');
  });

  it('returns em dash when quarters are unavailable', () => {
    expect(formatFiiHoldingChain({})).toBe('—');
    expect(formatFiiHoldingChain({ fii_holding_quarters: [{ pct: null }] })).toBe('—');
  });

  it('builds tooltip with period labels', () => {
    expect(buildFiiHoldingTooltip(sampleRow)).toBe(
      'Q4 FY25: 14.20%\nQ3 FY25: 13.80%\nQ2 FY25: 13.80%\nQ1 FY25: 12.95%',
    );
  });

  it('sorts by latest quarter percentage', () => {
    expect(getLatestFiiHoldingPct(sampleRow)).toBe(14.2);
    expect(getLatestFiiHoldingPct({ fii_holding_pct: 9.5 })).toBe(9.5);
  });

  it('accepts alternate backend field names defensively', () => {
    const altRow = {
      fii_quarters: [
        { quarter: 'Sep 2025', holding_pct: 11.1 },
        { quarter: 'Jun 2025', holding_pct: 10.4 },
      ],
    };
    expect(normalizeFiiHoldingQuarters(altRow)).toHaveLength(2);
    expect(formatFiiHoldingChain(altRow)).toBe('11.10 ≥ 10.40');
  });

  it('maps row fields for chart-fundamental tables', () => {
    const mapped = mapFiiHoldingFields(sampleRow);
    expect(mapped.fii4qLabel).toBe('14.20 ≥ 13.80 ≥ 13.80 ≥ 12.95');
    expect(mapped.fii4qSort).toBe(14.2);
    expect(mapped.fii_holding_trend_ok).toBe(true);
  });
});
