import {
  buildOutlookSearchParams,
  outlookTabToParam,
  resolveOutlookTab,
} from './outlookTabUtils';

describe('outlookTabUtils', () => {
  it('resolves outlook tab aliases to stable ids', () => {
    expect(resolveOutlookTab(null)).toBe('market');
    expect(resolveOutlookTab('')).toBe('market');
    expect(resolveOutlookTab('sector')).toBe('sector');
    expect(resolveOutlookTab('sub')).toBe('subsector');
    expect(resolveOutlookTab('subsector')).toBe('subsector');
  });

  it('keeps sector tab selected when building search params', () => {
    const params = buildOutlookSearchParams('', { tab: 'sector', clearSector: true });
    expect(params.get('outlookTab')).toBe('sector');
    expect(params.get('sector')).toBeNull();
  });

  it('preserves subsector drill-down in the URL', () => {
    const params = buildOutlookSearchParams('outlookTab=market', {
      tab: 'subsector',
      sector: 'Bank Nifty',
    });
    expect(params.get('outlookTab')).toBe('subsector');
    expect(params.get('sector')).toBe('Bank Nifty');
  });

  it('maps tab ids to URL param values', () => {
    expect(outlookTabToParam('subsector')).toBe('subsector');
    expect(outlookTabToParam('sector')).toBe('sector');
  });
});
