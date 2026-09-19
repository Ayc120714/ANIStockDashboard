import {
  entryTimingChipColor,
  formatEntryTiming,
  formatMinerviniScore,
  formatStageLabel,
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
});
