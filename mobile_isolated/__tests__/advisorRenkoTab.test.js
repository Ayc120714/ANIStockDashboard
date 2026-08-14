/**
 * Guard: Renko Smart is a dedicated Advisor hub tab id.
 */
const TABS = [
  {id: 'sig', label: 'Signals & alerts'},
  {id: 'renko', label: 'Renko Smart'},
  {id: 'trend', label: 'Trend reversal'},
  {id: 'chart', label: 'Chart & fundamental'},
  {id: 'ai', label: 'AI analysis'},
  {id: 'health', label: 'Portfolio health'},
  {id: 'hot', label: 'Hot Subsectors'},
  {id: 'ml', label: 'ML Setups'},
];

describe('advisor Renko Smart mobile tab', () => {
  it('includes renko as a top-level Advisor tab', () => {
    expect(TABS.some(t => t.id === 'renko')).toBe(true);
    expect(TABS.find(t => t.id === 'renko')?.label).toBe('Renko Smart');
  });

  it('places renko between signals and trend', () => {
    expect(TABS.map(t => t.id)).toEqual([
      'sig',
      'renko',
      'trend',
      'chart',
      'ai',
      'health',
      'hot',
      'ml',
    ]);
  });

  it('includes Hot Subsectors as a top-level Advisor tab', () => {
    expect(TABS.some(t => t.id === 'hot')).toBe(true);
    expect(TABS.find(t => t.id === 'hot')?.label).toBe('Hot Subsectors');
  });

  it('includes ML Setups as a top-level Advisor tab', () => {
    expect(TABS.some(t => t.id === 'ml')).toBe(true);
    expect(TABS.find(t => t.id === 'ml')?.label).toBe('ML Setups');
  });
});
