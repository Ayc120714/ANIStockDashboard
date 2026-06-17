import {buildSignalsTabRows, liveAlertToSignalRow} from '@core/utils/signalsTabPayload';

describe('signalsTabPayload', () => {
  it('maps live advisor alert to signal card row', () => {
    const row = liveAlertToSignalRow({
      id: 9,
      symbol: 'reliance',
      alert_type: 'entry_long',
      message: 'RELIANCE entry trigger',
      timestamp: '2026-06-17 10:15:00',
      entry_price: 2800,
      stop_loss: 2750,
      target_1: 2900,
      signal_score: 42,
    });
    expect(row.symbol).toBe('RELIANCE');
    expect(row._liveAlert).toBe(true);
    expect(row.entry_price).toBe(2800);
    expect(row.status).toBe('entry_ready');
  });

  it('prepends today live alerts before signal rows without duplicate symbols', () => {
    const merged = buildSignalsTabRows(
      [{symbol: 'TCS', status: 'watch'}, {symbol: 'INFY', status: 'watch'}],
      [
        {id: 1, symbol: 'RELIANCE', alert_type: 'entry_long', timestamp: '2026-06-17 11:00:00'},
        {id: 2, symbol: 'TCS', alert_type: 'entry_long', timestamp: '2026-06-17 10:30:00'},
      ],
    );
    expect(merged[0].symbol).toBe('RELIANCE');
    expect(merged[0]._liveAlert).toBe(true);
    expect(merged[1].symbol).toBe('TCS');
    expect(merged[1]._liveAlert).toBe(true);
    expect(merged.some(r => r.symbol === 'INFY')).toBe(true);
    expect(merged.filter(r => r.symbol === 'TCS')).toHaveLength(1);
  });
});
