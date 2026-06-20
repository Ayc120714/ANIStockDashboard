import { buildMarketBarChart } from './marketBarChart';

describe('buildMarketBarChart', () => {
  it('returns null for empty input', () => {
    expect(buildMarketBarChart([])).toBeNull();
    expect(buildMarketBarChart(null)).toBeNull();
  });

  it('builds proportional bars without stretching geometry', () => {
    const chart = buildMarketBarChart([10, -5, 8], 1, 68);
    expect(chart.width).toBeGreaterThanOrEqual(160);
    expect(chart.height).toBe(68);
    expect(chart.rects).toHaveLength(3);
    expect(chart.rects[1].isActive).toBe(true);
    expect(chart.rects[0].fill).toBe('#28a745');
    expect(chart.rects[1].fill).toBe('#dc3545');
  });

  it('uses viewBox-friendly width for many data points', () => {
    const values = Array.from({ length: 20 }, (_, i) => (i % 2 === 0 ? 5 : -3));
    const chart = buildMarketBarChart(values);
    expect(chart.width).toBe(Math.max(160, values.length * 12));
  });
});
