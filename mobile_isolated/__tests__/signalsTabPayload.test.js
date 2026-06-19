import {
  buildSignalsTabRows,
  isActionableTodaySignalRow,
  isLiveEntryExitAlert,
  isSignalRowFromToday,
  liveAlertToSignalRow,
  mapLiveAlertStatus,
} from '@core/utils/signalsTabPayload';
import {NOTIFICATION_TIMEZONE} from '@core/utils/alertInboxUtils';

function istDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: NOTIFICATION_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function istTimestamp(date = new Date()) {
  return `${istDateKey(date)} 11:00:00`;
}

describe('signalsTabPayload', () => {
  const today = istTimestamp(new Date());
  const yesterday = istTimestamp(new Date(Date.now() - 86_400_000));

  it('maps live advisor alert to signal card row', () => {
    const row = liveAlertToSignalRow({
      id: 9,
      symbol: 'reliance',
      alert_type: 'entry_long',
      message: 'RELIANCE entry trigger',
      timestamp: today,
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

  it('maps EXIT_READY alerts to exit_watch status', () => {
    expect(mapLiveAlertStatus({alert_type: 'EXIT_READY'})).toBe('exit_watch');
    expect(liveAlertToSignalRow({symbol: 'TCS', alert_type: 'EXIT_READY', timestamp: today}).status).toBe(
      'exit_watch',
    );
  });

  it('prepends today live alerts before signal rows without duplicate symbols', () => {
    const merged = buildSignalsTabRows(
      [
        {symbol: 'TCS', status: 'entry_ready', scan_time: today},
        {symbol: 'INFY', status: 'watch', scan_time: yesterday},
      ],
      [
        {id: 1, symbol: 'RELIANCE', alert_type: 'ENTRY_READY', timestamp: today},
        {id: 2, symbol: 'TCS', alert_type: 'ENTRY_READY', timestamp: today},
      ],
    );
    expect(merged[0].symbol).toBe('RELIANCE');
    expect(merged[0]._liveAlert).toBe(true);
    expect(merged[1].symbol).toBe('TCS');
    expect(merged[1]._liveAlert).toBe(true);
    expect(merged.some(r => r.symbol === 'INFY')).toBe(false);
    expect(merged.filter(r => r.symbol === 'TCS')).toHaveLength(1);
  });

  it('excludes signal rows not scanned during today live session', () => {
    expect(isSignalRowFromToday({symbol: 'TCS', scan_time: today})).toBe(true);
    expect(isSignalRowFromToday({symbol: 'TCS', scan_time: yesterday})).toBe(false);
    expect(
      buildSignalsTabRows([{symbol: 'OLD', status: 'watch', scan_time: yesterday}], []),
    ).toEqual([]);
  });

  it('includes actionable entry_ready rows scanned today', () => {
    expect(isActionableTodaySignalRow({symbol: 'TCS', status: 'entry_ready', scan_time: today})).toBe(true);
    expect(isActionableTodaySignalRow({symbol: 'TCS', status: 'watch', scan_time: today})).toBe(false);
    expect(isLiveEntryExitAlert({alert_type: 'ENTRY_READY'})).toBe(true);
    expect(isLiveEntryExitAlert({alert_type: 'EXIT_READY'})).toBe(true);
  });
});
