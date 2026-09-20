import {
  checklistPassedCount,
  formatEvidenceScore,
  formatPhaseLabel,
  phaseChipColor,
} from './compressionBreakout';
import { resolveAdvisorTabIndex } from './advisorTabIndex';
import { LIVE_PAGE_CACHE_KEYS } from './livePageCacheKeys';

describe('compression breakout utils', () => {
  it('formats phase labels and chip colors', () => {
    expect(formatPhaseLabel('breakout')).toBe('Breakout');
    expect(formatPhaseLabel('retest_hold')).toBe('Retest held');
    expect(formatPhaseLabel('renewed')).toBe('Renewed');
    expect(phaseChipColor('renewed')).toBe('success');
    expect(phaseChipColor('breakout')).toBe('warning');
  });

  it('counts checklist evidence', () => {
    expect(
      checklistPassedCount({
        compression_first: true,
        volume_expanded: true,
        strong_close: true,
        level_held: false,
        retest_volume_lighter: false,
        renewed_participation: false,
      }),
    ).toBe(3);
    expect(formatEvidenceScore(4)).toBe('4/6');
  });
});

describe('advisor Compression Breakout tab routing', () => {
  it('maps compression/vcp deep-links to tab 9', () => {
    expect(resolveAdvisorTabIndex('compression')).toBe(9);
    expect(resolveAdvisorTabIndex('vcp')).toBe(9);
    expect(resolveAdvisorTabIndex('compression_breakout')).toBe(9);
    expect(resolveAdvisorTabIndex('retest')).toBe(9);
    expect(resolveAdvisorTabIndex('9')).toBe(9);
  });

  it('keeps stage analysis on tab 8', () => {
    expect(resolveAdvisorTabIndex('stage')).toBe(8);
  });
});

describe('compression breakout cache key', () => {
  it('versions daily and weekly slots separately', () => {
    expect(LIVE_PAGE_CACHE_KEYS.compressionBreakout('1d')).toContain('1d');
    expect(LIVE_PAGE_CACHE_KEYS.compressionBreakout('1w')).toContain('1w');
  });
});
