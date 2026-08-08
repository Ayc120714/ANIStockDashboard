import { filterHotSubsectorGroups, normalizeHotSubsectorsPayload } from './hotSubsectorsAdvisor';

describe('hot subsectors advisor helpers', () => {
  it('keeps only ALL strictly greater than 75', () => {
    const out = filterHotSubsectorGroups([
      { subsector: 'A', all: 76 },
      { subsector: 'B', all: 75 },
      { subsector: 'C', all: 90 },
      { subsector: 'D', all: null },
    ]);
    expect(out.map((g) => g.subsector)).toEqual(['A', 'C']);
  });

  it('normalizes payload and applies threshold gate', () => {
    const n = normalizeHotSubsectorsPayload({
      threshold_all: 75,
      subsectors: [
        { subsector: 'Hot', all: 88, stocks: [{ symbol: 'X', chg_pct: 2 }] },
        { subsector: 'Warm', all: 70, stocks: [] },
      ],
    });
    expect(n.subsectors).toHaveLength(1);
    expect(n.subsectors[0].subsector).toBe('Hot');
    expect(n.subsectors[0].stocks[0].symbol).toBe('X');
  });
});
