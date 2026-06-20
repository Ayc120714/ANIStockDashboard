import { resolveScreenTab, screenTabToParam } from './screenTabUtils';

describe('screenTabUtils', () => {
  it('defaults to AI Picks when screenTab is missing', () => {
    expect(resolveScreenTab(null)).toBe('AI Picks');
    expect(resolveScreenTab('')).toBe('AI Picks');
  });

  it('resolves screen tab slugs from the URL', () => {
    expect(resolveScreenTab('top-movers')).toBe('Top Movers');
    expect(resolveScreenTab('alpha-tracker')).toBe('Alpha Tracker');
    expect(resolveScreenTab('ai-picks')).toBe('AI Picks');
  });

  it('round-trips tab labels through URL params', () => {
    expect(screenTabToParam('Volume Movers')).toBe('volume-movers');
    expect(resolveScreenTab(screenTabToParam('Trending'))).toBe('Trending');
  });
});
