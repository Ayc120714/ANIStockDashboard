import {
  ensureMlSetupRows,
  formatMlSetupType,
  mlSetupDirectionLabel,
  mlSetupsRowsAndMetaFromCache,
  normalizeMlSetupsPayload,
} from './mlSetupsAdvisor';

describe('Advisor ML Setups payload', () => {
  it('keeps high-conviction rows and ready-for-open flag for the new Advisor tab', () => {
    const normalized = normalizeMlSetupsPayload({
      session_date: '2026-08-13',
      checkpoint: 'preopen',
      ready_for_open: true,
      live_enabled: true,
      min_score: 0.55,
      feature_symbols: 1165,
      total_scored: 3,
      high_conviction: 2,
      data: [
        { symbol: 'VARROC', alert_type: 'weekly_cross_up_high', ml_score: 0.82, side: 1 },
        { symbol: '', alert_type: 'vwap_cross_above', ml_score: 0.9 },
        { symbol: 'HAL', alert_type: 'weekly_cross_down_high', ml_score: 0.76, side: -1 },
      ],
    });
    expect(normalized.ready_for_open).toBe(true);
    expect(normalized.live_enabled).toBe(true);
    expect(normalized.data.map((r) => r.symbol)).toEqual(['VARROC', 'HAL']);
    expect(formatMlSetupType('weekly_cross_up_high')).toBe('Weekly Cross Up High');
    expect(mlSetupDirectionLabel(normalized.data[0])).toBe('Long');
    expect(mlSetupDirectionLabel(normalized.data[1])).toBe('Short');
  });

  it('treats omitted live_enabled as off so the Advisor chip does not fake a live session', () => {
    const normalized = normalizeMlSetupsPayload({
      ready_for_open: true,
      data: [{ symbol: 'HAL', alert_type: 'weekly_cross_down_high', ml_score: 0.76, side: -1 }],
    });
    expect(normalized.live_enabled).toBe(false);
    expect(normalized.ready_for_open).toBe(true);
  });

  it('does not treat a wrapped cache object as the row list (blank Advisor crash)', () => {
    const rows = [{ symbol: 'HAL', alert_type: 'weekly_cross_down_high', ml_score: 0.76 }];
    const fromWrap = mlSetupsRowsAndMetaFromCache({
      data: { data: rows, meta: { live_enabled: true, session_date: '2026-08-14' } },
      updatedAt: 1,
    });
    expect(fromWrap.rows.map((r) => r.symbol)).toEqual(['HAL']);
    expect(fromWrap.meta.live_enabled).toBe(true);

    const poisoned = mlSetupsRowsAndMetaFromCache({
      data: { data: rows, meta: { ready_for_open: true } },
    });
    expect(Array.isArray(poisoned.rows)).toBe(true);
    expect(() => [...ensureMlSetupRows(poisoned.rows)]).not.toThrow();

    const objectAsRows = { data: rows, meta: { ready_for_open: true } };
    expect(ensureMlSetupRows(objectAsRows)).toEqual([]);
  });
});
