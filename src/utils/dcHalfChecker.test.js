import { formatDcHalfPhase, normalizeDcHalfTimeframe } from './dcHalfChecker';

describe('dcHalfChecker helpers', () => {
  it('normalizes Chartink-style timeframe aliases to API ids (regression)', () => {
    expect(normalizeDcHalfTimeframe('5min')).toBe('5m');
    expect(normalizeDcHalfTimeframe('30')).toBe('30m');
    expect(normalizeDcHalfTimeframe('1hr')).toBe('1h');
    expect(normalizeDcHalfTimeframe('daily')).toBe('1d');
    expect(normalizeDcHalfTimeframe('weekly')).toBe('1w');
    expect(normalizeDcHalfTimeframe('')).toBe('1d');
  });

  it('maps phase codes to readable labels for the strategy table', () => {
    expect(formatDcHalfPhase('cross_up')).toBe('Cross up');
    expect(formatDcHalfPhase('at_dc_high')).toBe('At DC high');
    expect(formatDcHalfPhase('retrace_dc_low')).toBe('Retrace low');
    expect(formatDcHalfPhase('rising_again')).toBe('Rising again');
    expect(formatDcHalfPhase(null)).toBe('—');
  });
});
