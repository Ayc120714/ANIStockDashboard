import {
  buildLiveSetupRows,
  isTodaySetupRow,
  liveAlertToSetupRow,
  partitionLiveSetups,
} from './liveSetupsPayload';
import { NOTIFICATION_TIMEZONE } from './alertInboxUtils';
import { getSetupLifecycleState, shouldRemoveSetupRow } from './setupLifecycle';

function istTimestamp(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: NOTIFICATION_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date).replace(/-/g, '-') + ' 10:15:00';
}

describe('setupLifecycle', () => {
  it('removes bullish setup when stop loss is hit', () => {
    const row = {
      symbol: 'TCS',
      cmp: 3900,
      entry_price: 4000,
      stop_loss: 3950,
      target_1: 4100,
      target_2: 4200,
      trend: 'bullish',
    };
    expect(shouldRemoveSetupRow(row)).toBe(true);
    expect(getSetupLifecycleState(row).statusLabel).toBe('SL HIT');
  });

  it('removes bullish setup when target 2 is hit', () => {
    const row = {
      symbol: 'INFY',
      cmp: 1520,
      entry_price: 1400,
      stop_loss: 1360,
      target_1: 1480,
      target_2: 1500,
      trend: 'bullish',
    };
    expect(shouldRemoveSetupRow(row)).toBe(true);
    expect(getSetupLifecycleState(row).t2Hit).toBe(true);
  });

  it('keeps active setup after T1 hit but before SL/T2', () => {
    const row = {
      symbol: 'RELIANCE',
      cmp: 2900,
      entry_price: 2850,
      stop_loss: 2780,
      target_1: 2880,
      target_2: 3020,
      trend: 'bullish',
    };
    expect(shouldRemoveSetupRow(row)).toBe(false);
    expect(getSetupLifecycleState(row).t1Hit).toBe(true);
  });
});

describe('liveSetupsPayload', () => {
  const today = istTimestamp(new Date());

  it('maps live advisor alert into setup row', () => {
    const row = liveAlertToSetupRow({
      id: 1,
      symbol: 'reliance',
      alert_type: 'ENTRY_READY',
      message: 'Entry ready',
      timestamp: today,
      entry_price: 2850,
      stop_loss: 2780,
      target_1: 2950,
      target_2: 3020,
    });
    expect(row.symbol).toBe('RELIANCE');
    expect(row.status).toBe('entry_ready');
  });

  it('filters out SL/T2 closed rows from setup board', () => {
    const rows = buildLiveSetupRows(
      [],
      [{
        id: 2,
        symbol: 'TCS',
        alert_type: 'ENTRY_READY',
        timestamp: today,
        entry_price: 4000,
        stop_loss: 3950,
        target_1: 4100,
        target_2: 4200,
        cmp: 3940,
      }],
    );
    expect(rows).toHaveLength(0);
  });

  it('excludes demo test alerts from live setup board', () => {
    const rows = buildLiveSetupRows(
      [],
      [{
        id: 99,
        symbol: 'DEMO',
        alert_type: 'demo_mobile_test',
        source: 'demo',
        message: '[DEMO] test alert',
        timestamp: today,
      }],
    );
    expect(rows).toHaveLength(0);
  });

  it('partitions today and week buckets', () => {
    const rows = buildLiveSetupRows(
      [{
        symbol: 'INFY',
        cmp: 1500,
        entry_price: 1480,
        stop_loss: 1450,
        target_1: 1520,
        target_2: 1560,
        status: 'entry_ready',
        scan_time: today,
      }],
      [],
    );
    const parts = partitionLiveSetups(rows);
    expect(parts.today.length).toBe(1);
    expect(parts.week.length).toBe(1);
    expect(isTodaySetupRow(rows[0])).toBe(true);
  });
});
