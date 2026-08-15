import {
  formatMlSetupType,
  mlSetupDirectionLabel,
  normalizeMlSetupsPayload,
  ensureMlSetupRows,
  symbolsFromMlSetupRows,
} from '../src/core/utils/mlSetupsAdvisor';
import {buildTradingViewSymbolsCsv} from '../src/core/utils/tradingViewCsv';

describe('Advisor ML Setups payload (mobile)', () => {
  it('keeps high-conviction rows and ready-for-open flag for the new Advisor tab', () => {
    const normalized = normalizeMlSetupsPayload({
      session_date: '2026-08-13',
      checkpoint: 'preopen',
      ready_for_open: true,
      live_enabled: true,
      high_conviction: 2,
      data: [
        {symbol: 'VARROC', alert_type: 'weekly_cross_up_high', ml_score: 0.82, side: 1},
        {symbol: '', alert_type: 'vwap_cross_above', ml_score: 0.9},
        {symbol: 'HAL', alert_type: 'weekly_cross_down_high', ml_score: 0.76, side: -1},
      ],
    });
    expect(normalized.ready_for_open).toBe(true);
    expect(normalized.live_enabled).toBe(true);
    expect(normalized.data.map(r => r.symbol)).toEqual(['VARROC', 'HAL']);
    expect(formatMlSetupType('weekly_cross_up_high')).toBe('Weekly Cross Up High');
    expect(mlSetupDirectionLabel(normalized.data[0])).toBe('Long');
    expect(mlSetupDirectionLabel(normalized.data[1])).toBe('Short');
  });

  it('treats omitted live_enabled as off so the Advisor chip does not fake a live session', () => {
    const normalized = normalizeMlSetupsPayload({
      ready_for_open: true,
      data: [{symbol: 'HAL', alert_type: 'weekly_cross_down_high', ml_score: 0.76, side: -1}],
    });
    expect(normalized.live_enabled).toBe(false);
    expect(normalized.ready_for_open).toBe(true);
  });

  it('never treats a cache object as the row list (blank Advisor crash)', () => {
    expect(ensureMlSetupRows({data: [{symbol: 'HAL'}], meta: {}})).toEqual([]);
    expect(ensureMlSetupRows([{symbol: 'HAL'}])).toEqual([{symbol: 'HAL'}]);
  });

  it('builds unique TradingView CSV from ML setup rows in display order', () => {
    const csv = buildTradingViewSymbolsCsv(
      symbolsFromMlSetupRows([
        {symbol: 'varroc', alert_type: 'weekly_cross_up_high'},
        {symbol: 'HAL', alert_type: 'weekly_cross_down_high'},
        {symbol: 'VARROC', alert_type: 'vwap_cross_above'},
        {symbol: '', alert_type: 'unusual_volume'},
      ]),
    );
    expect(csv).toBe('NSE:VARROC,NSE:HAL');
  });
});
