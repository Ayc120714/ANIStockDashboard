import { resolveAdvisorTabIndex } from './advisorTabIndex';

describe('advisor Renko Smart tab routing', () => {
  it('maps renko advisorTab keys to index 1', () => {
    expect(resolveAdvisorTabIndex('renko')).toBe(1);
    expect(resolveAdvisorTabIndex('renko_smart')).toBe(1);
    expect(resolveAdvisorTabIndex('RenkoSmart')).toBe(1);
  });

  it('keeps legacy tabs shifted after Renko', () => {
    expect(resolveAdvisorTabIndex('signals')).toBe(0);
    expect(resolveAdvisorTabIndex('trend')).toBe(2);
    expect(resolveAdvisorTabIndex('chart')).toBe(3);
    expect(resolveAdvisorTabIndex('ai')).toBe(4);
    expect(resolveAdvisorTabIndex('portfolio')).toBe(5);
  });

  it('maps hot subsectors advisorTab keys to index 6', () => {
    expect(resolveAdvisorTabIndex('hot')).toBe(6);
    expect(resolveAdvisorTabIndex('hot_subsectors')).toBe(6);
    expect(resolveAdvisorTabIndex('HotSubsectors')).toBe(6);
  });

  it('maps ML setups advisorTab keys to index 7', () => {
    expect(resolveAdvisorTabIndex('ml')).toBe(7);
    expect(resolveAdvisorTabIndex('ml_setups')).toBe(7);
    expect(resolveAdvisorTabIndex('live_ml')).toBe(7);
  });
});
