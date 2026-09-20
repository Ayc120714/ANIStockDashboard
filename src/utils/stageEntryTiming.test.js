import {
  entryTimingChipColor,
  formatConfirmTimeframes,
  formatEntryTiming,
  formatMinerviniScore,
  formatRsCross,
  formatStageLabel,
  isMtfConfirmPass,
  isRsCrossSetupRow,
  isWeeklyConfirmPass,
  weeklyConfirmPassedCount,
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

  it('detects Chartink weekly confirm complete filter (regression)', () => {
    const pass = {
      weekly_confirm_pass: true,
      weekly_confirm: {
        weekly_psar_cross_1w_ago: true,
        weekly_close_up: true,
        weekly_prior_dip: true,
        weekly_rvol_rising: true,
      },
    };
    expect(isWeeklyConfirmPass(pass)).toBe(true);
    expect(weeklyConfirmPassedCount(pass)).toBe(4);
  });

  it('unifies Daily/Weekly/Monthly confirm into one list (regression)', () => {
    // Bug: Stage Analysis only had weekly confirm — empty lists; need D/W/M OR.
    const row = {
      mtf_confirm_pass: true,
      confirm_timeframes: ['1d', '1w'],
      weekly_confirm_pass: true,
    };
    expect(isMtfConfirmPass(row)).toBe(true);
    expect(formatConfirmTimeframes(row)).toBe('Daily+Weekly');
    expect(
      isMtfConfirmPass({
        mtf_confirm_pass: false,
        confirm_timeframes: [],
        weekly_confirm_pass: false,
      }),
    ).toBe(false);
  });
});
