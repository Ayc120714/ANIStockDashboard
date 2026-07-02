import {parseWeeklyEntriesResponse} from '@core/utils/webParity';

describe('parseWeeklyEntriesResponse', () => {
  it('dedupes duplicate symbols from weekly-entries payload', () => {
    const payload = {
      count: 4,
      data: [
        {symbol: 'CARBORATING', weekly_entry_gap_pct: 2.1},
        {symbol: 'CARBORATING', weekly_entry_gap_pct: 2.1},
        {symbol: 'ITDC', weekly_entry_gap_pct: 0.4},
        {symbol: 'ITDC', weekly_entry_gap_pct: 1.2},
      ],
    };
    const out = parseWeeklyEntriesResponse(payload);
    expect(out).toHaveLength(2);
    expect(out.map((r) => r.symbol)).toEqual(['ITDC', 'CARBORATING']);
  });
});
