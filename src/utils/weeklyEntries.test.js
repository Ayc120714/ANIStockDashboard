import { dedupeWeeklyEntriesBySymbol } from './weeklyEntries';

describe('dedupeWeeklyEntriesBySymbol', () => {
  it('keeps one row per symbol with the smallest entry gap', () => {
    const rows = [
      { symbol: 'CARBORATING', weekly_entry_gap_pct: 2.1, price: 1702 },
      { symbol: 'CARBORATING', weekly_entry_gap_pct: 2.1, price: 1702 },
      { symbol: 'ITDC', weekly_entry_gap_pct: 0.4, price: 808.5 },
      { symbol: 'ITDC', weekly_entry_gap_pct: 1.2, price: 808.5 },
      { symbol: 'JAMNAAUTO', weekly_entry_gap_pct: 1.6, price: 131.6 },
    ];
    const out = dedupeWeeklyEntriesBySymbol(rows);
    expect(out).toHaveLength(3);
    expect(out.map((r) => r.symbol)).toEqual(['ITDC', 'JAMNAAUTO', 'CARBORATING']);
    expect(out.find((r) => r.symbol === 'ITDC')?.weekly_entry_gap_pct).toBe(0.4);
  });
});
