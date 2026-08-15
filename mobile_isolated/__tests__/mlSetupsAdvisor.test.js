import {
  formatMlSetupType,
  mlSetupDirectionLabel,
  normalizeMlSetupsPayload,
  ensureMlSetupRows,
  symbolsFromMlSetupRows,
  sortMlSetupRows,
  ML_SETUPS_PAGE_SIZE,
  ML_SETUPS_DEFAULT_SORT_COL,
  ML_SETUPS_DEFAULT_SORT_DIR,
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

  it('defaults to 10 rows per page sorted by RVOL descending', () => {
    expect(ML_SETUPS_PAGE_SIZE).toBe(10);
    expect(ML_SETUPS_DEFAULT_SORT_COL).toBe('vol_ratio');
    expect(ML_SETUPS_DEFAULT_SORT_DIR).toBe('desc');
    const sorted = sortMlSetupRows([
      {symbol: 'LOW', vol_ratio: 0.4, ml_score: 0.9},
      {symbol: 'HIGH', vol_ratio: 3.2, ml_score: 0.6},
      {symbol: 'MID', vol_ratio: 1.1, ml_score: 0.7},
    ]);
    expect(sorted.map(r => r.symbol)).toEqual(['HIGH', 'MID', 'LOW']);
  });

  it('pages ML Setups 10 at a time instead of slicing the first 80 rows', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.resolve(__dirname, '../src/features/advisor/MlSetupsSignalsSection.js'),
      'utf8',
    );
    expect(src).toMatch(/ML_SETUPS_PAGE_SIZE/);
    expect(src).toMatch(/usePagedList/);
    expect(src).toMatch(/sortKey="vol_ratio"/);
    expect(src).not.toMatch(/slice\(0,\s*80\)/);
  });
});
