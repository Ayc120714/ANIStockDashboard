import {formatDcHalfPhaseLabel} from '@core/utils/dcHalfChecker';

describe('dcHalfChecker mobile helpers', () => {
  it('formats phase labels for Screens hub table', () => {
    expect(formatDcHalfPhaseLabel('cross_up')).toBe('Cross up');
    expect(formatDcHalfPhaseLabel('at_dc_high')).toBe('At DC high');
    expect(formatDcHalfPhaseLabel(null)).toBe('—');
  });
});
