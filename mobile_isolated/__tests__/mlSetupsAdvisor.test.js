import {
  formatMlSetupType,
  mlSetupDirectionLabel,
  normalizeMlSetupsPayload,
} from '../src/core/utils/mlSetupsAdvisor';

describe('Advisor ML Setups payload (mobile)', () => {
  it('keeps high-conviction rows and ready-for-open flag for the new Advisor tab', () => {
    const normalized = normalizeMlSetupsPayload({
      session_date: '2026-08-13',
      checkpoint: 'preopen',
      ready_for_open: true,
      high_conviction: 2,
      data: [
        {symbol: 'VARROC', alert_type: 'weekly_cross_up_high', ml_score: 0.82, side: 1},
        {symbol: '', alert_type: 'vwap_cross_above', ml_score: 0.9},
        {symbol: 'HAL', alert_type: 'weekly_cross_down_high', ml_score: 0.76, side: -1},
      ],
    });
    expect(normalized.ready_for_open).toBe(true);
    expect(normalized.data.map(r => r.symbol)).toEqual(['VARROC', 'HAL']);
    expect(formatMlSetupType('weekly_cross_up_high')).toBe('Weekly Cross Up High');
    expect(mlSetupDirectionLabel(normalized.data[0])).toBe('Long');
    expect(mlSetupDirectionLabel(normalized.data[1])).toBe('Short');
  });
});
