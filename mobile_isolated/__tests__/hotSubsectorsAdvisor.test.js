import {
  filterHotSubsectorGroups,
  normalizeHotSubsectorsPayload,
} from '../src/core/utils/hotSubsectorsAdvisor';

describe('hot subsectors advisor helpers (mobile)', () => {
  it('keeps only ALL strictly greater than 75', () => {
    const out = filterHotSubsectorGroups([
      {subsector: 'A', all: 76},
      {subsector: 'B', all: 75},
      {subsector: 'C', all: 90},
    ]);
    expect(out.map(g => g.subsector)).toEqual(['A', 'C']);
  });

  it('normalizes payload from subsectors or data alias', () => {
    const n = normalizeHotSubsectorsPayload({
      threshold_all: 75,
      data: [{subsector: 'Hot', all: 81, stocks: [{symbol: 'X'}]}],
    });
    expect(n.subsectors).toHaveLength(1);
    expect(n.subsectors[0].stocks[0].symbol).toBe('X');
  });
});
