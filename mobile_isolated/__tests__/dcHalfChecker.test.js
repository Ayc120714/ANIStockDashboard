import {
  formatDcHalfPhaseLabel,
  formatDcHalfRvol,
  isDcHalfPsarConfirm,
  isDcHalfVolumeExpanding,
} from '@core/utils/dcHalfChecker';

describe('dcHalfChecker mobile helpers', () => {
  it('formats phase labels for Screens hub table', () => {
    expect(formatDcHalfPhaseLabel('cross_up')).toBe('Cross up');
    expect(formatDcHalfPhaseLabel('at_dc_high')).toBe('At DC high');
    expect(formatDcHalfPhaseLabel(null)).toBe('—');
  });

  it('detects PSAR confirm and volume expand for DC Half alert TFs (regression)', () => {
    const hit = {
      psar_confirm: true,
      volume_expanding: true,
      volume_ratio_prev: 0.9,
      volume_ratio: 1.4,
    };
    expect(isDcHalfPsarConfirm(hit)).toBe(true);
    expect(isDcHalfVolumeExpanding(hit)).toBe(true);
    expect(formatDcHalfRvol(hit)).toBe('0.90→1.40');
  });
});
