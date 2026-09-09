import {
  buildLiveSetupRows,
  isTodaySetupRow,
  liveAlertToSetupRow,
  partitionLiveSetups,
} from '@core/utils/liveSetupsPayload';
import {NOTIFICATION_TIMEZONE} from '@core/utils/alertInboxUtils';
import {getSetupLifecycleState, shouldRemoveSetupRow} from '@core/utils/setupLifecycle';

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

  it('keeps high-conviction weekly low/mid close-above on the live setup board', () => {
    const rows = buildLiveSetupRows(
      [],
      [{
        id: 7,
        symbol: 'HAL',
        alert_type: 'weekly_cross_up_low',
        timestamp: today,
        ml_score: 0.81,
        source: 'ml_setup',
        signal_detail: {entry: 900, stop_loss: 880, target_1: 920, target_2: 940},
      }],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].symbol).toBe('HAL');
    expect(rows[0].status).toBe('entry_ready');
  });

  it('drops marked-read and prior-day weekly crosses from the live board', () => {
    const yesterday = istTimestamp(new Date(Date.now() - 24 * 3600 * 1000));
    const rows = buildLiveSetupRows(
      [],
      [
        {
          id: 8,
          symbol: 'SPAL',
          alert_type: 'weekly_cross_up_high',
          timestamp: today,
          ml_score: 0.7,
          source: 'ml_setup',
          is_read: true,
          signal_detail: {entry: 1050, stop_loss: 1040, target_1: 1070, target_2: 1090},
        },
        {
          id: 9,
          symbol: 'SHILPAMED',
          alert_type: 'weekly_cross_up_high',
          timestamp: yesterday,
          ml_score: 0.74,
          source: 'ml_setup',
          signal_detail: {entry: 500, stop_loss: 480, target_1: 520, target_2: 540},
        },
      ],
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
