import {
  buildEarlyDetectionTableModel,
  defaultHistoryDateRange,
  earlyDetectionStatusLabel,
  normalizeEarlyDetectionRow,
  recentLookbackDaysForTimeframe,
  sortEarlyDetectionRows,
  sqzColorToSet,
} from './earlyDetectionTable';

describe('earlyDetectionTable', () => {
  test('sqzColorToSet buckets', () => {
    expect(sqzColorToSet('brown')).toBe('brown');
    expect(sqzColorToSet('lime')).toBe('lime');
    expect(sqzColorToSet('light_green')).toBe('green');
    expect(sqzColorToSet('red')).toBeNull();
  });

  test('normalize public API row with status', () => {
    const row = normalizeEarlyDetectionRow({
      symbol: 'test',
      status: 'confirmed',
      sqz_color: 'light_green',
      close: 110,
      ema_fast: 100,
      ema_slow: 90,
      rvol: 1.5,
      trigger_date: '2026-05-10',
    });
    expect(row.sqz_set).toBe('green');
    expect(row.is_complete).toBe(true);
    expect(row.status).toBe('confirmed');
    expect(row.status_label).toBe('Confirmed');
  });

  test('normalize active row without proprietary fields', () => {
    const row = normalizeEarlyDetectionRow({
      symbol: 'WEL',
      status: 'active',
      trigger_date: '2026-05-15',
      sqz_set: 'lime',
      rvol: 2.1,
      close: 50,
      ema_fast: 55,
      ema_slow: 52,
    });
    expect(row.is_complete).toBe(true);
    expect(row.status).toBe('active');
    expect(row.status_label).toBe('Active');
  });

  test('filter and sort by sqz_set then rvol', () => {
    const raw = [
      { symbol: 'A', status: 'confirmed', sqz_set: 'brown', rvol: 1.2, trigger_date: '2026-05-01' },
      { symbol: 'B', status: 'confirmed', sqz_set: 'lime', rvol: 2.5, trigger_date: '2026-05-02' },
      { symbol: 'C', status: 'watch', sqz_set: 'lime', rvol: 9, trigger_date: '2026-05-03' },
    ];
    const { sorted, counts } = buildEarlyDetectionTableModel(raw, {
      sqzFilter: 'lime',
      sortCol: 'rvol',
      sortDir: 'desc',
    });
    expect(counts.lime).toBe(1);
    expect(sorted).toHaveLength(1);
    expect(sorted[0].symbol).toBe('B');
  });

  test('sort trigger_date descending', () => {
    const rows = [
      normalizeEarlyDetectionRow({ symbol: 'X', status: 'confirmed', trigger_date: '2026-05-01', sqz_set: 'brown' }),
      normalizeEarlyDetectionRow({ symbol: 'Y', status: 'confirmed', trigger_date: '2026-05-10', sqz_set: 'brown' }),
    ];
    const out = sortEarlyDetectionRows(rows, 'trigger_date', 'desc');
    expect(out[0].symbol).toBe('Y');
  });

  test('status labels', () => {
    expect(earlyDetectionStatusLabel('confirmed')).toBe('Confirmed');
    expect(earlyDetectionStatusLabel('active')).toBe('Active');
  });

  test('recent lookback days by timeframe', () => {
    expect(recentLookbackDaysForTimeframe('daily')).toBe(2);
    expect(recentLookbackDaysForTimeframe('weekly')).toBe(14);
    expect(recentLookbackDaysForTimeframe('monthly')).toBe(62);
  });

  test('default history range has from before to', () => {
    const { from, to } = defaultHistoryDateRange('daily');
    expect(from < to).toBe(true);
  });
});
