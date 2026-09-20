import {
  entryTimingChipColor,
  formatEntryTiming,
  formatMinerviniScore,
  formatRsCross,
  formatStageLabel,
  isRsCrossSetupRow,
} from './stageEntryTiming';

describe('stageEntryTiming helpers', () => {
  it('formats Minervini score and stage labels', () => {
    expect(formatMinerviniScore(7)).toBe('7/8');
    expect(formatStageLabel(2)).toContain('Stage 2');
    expect(formatEntryTiming('constructive_pullback')).toMatch(/pullback/i);
  });

  it('maps entry timing chip colors', () => {
    expect(entryTimingChipColor('breakout_watch').bgcolor).toBe('#e8f5e9');
    expect(entryTimingChipColor('deteriorating').color).toBe('#c62828');
  });

  it('formats RS cross and detects just-crossed setup rows', () => {
    expect(formatRsCross({ rs_rating_prev: 68, rs_rating: 72 })).toBe('68→72');
    expect(
      isRsCrossSetupRow({
        rs_just_crossed_70: true,
        other_setup_pass: true,
        rs_rating_prev: 68,
        rs_rating: 72,
      }),
    ).toBe(true);
    expect(
      isRsCrossSetupRow({
        rs_just_crossed_70: false,
        other_setup_pass: true,
        rs_rating_prev: 75,
        rs_rating: 80,
      }),
    ).toBe(false);
  });
});
