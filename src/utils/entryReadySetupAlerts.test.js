import {
  diffNewEntryReadySetups,
  entryReadySetupsDigest,
  filterEntryReadySetupRows,
  isEntryReadySetupRow,
  partitionEntryReadySetups,
} from './liveSetupsPayload';
import {
  buildEntryReadyPopupMessage,
  detectNewEntryReadySetups,
  saveEntryReadyDigest,
} from './entryReadySetupAlerts';

describe('entry ready setup alerts', () => {
  const entryReadyRow = {
    symbol: 'RELIANCE',
    status: 'entry_ready',
    entry_price: 2850,
    stop_loss: 2780,
    target_1: 2950,
    target_2: 3020,
    scan_time: '2026-06-23 10:15:00',
  };

  const inTradeRow = {
    symbol: 'TCS',
    status: 'in_trade',
    entry_price: 4000,
    stop_loss: 3950,
    target_1: 4100,
    target_2: 4200,
    scan_time: '2026-06-23 10:15:00',
  };

  it('keeps only tradeable entry-ready rows', () => {
    expect(isEntryReadySetupRow(entryReadyRow)).toBe(true);
    expect(isEntryReadySetupRow(inTradeRow)).toBe(false);
    expect(filterEntryReadySetupRows([entryReadyRow, inTradeRow])).toHaveLength(1);
  });

  it('partitions entry-ready rows into today and week buckets', () => {
    const parts = partitionEntryReadySetups([entryReadyRow, inTradeRow]);
    expect(parts.all).toHaveLength(1);
    expect(parts.today.length).toBeGreaterThanOrEqual(0);
    expect(parts.week.length).toBeGreaterThanOrEqual(0);
  });

  it('detects newly appeared entry-ready rows from digest', () => {
    const digest = entryReadySetupsDigest([entryReadyRow]);
    const fresh = diffNewEntryReadySetups(digest, [entryReadyRow, {
      ...entryReadyRow,
      symbol: 'INFY',
    }]);
    expect(fresh).toHaveLength(1);
    expect(fresh[0].symbol).toBe('INFY');
  });

  it('builds popup copy for one or many stocks', () => {
    expect(buildEntryReadyPopupMessage([entryReadyRow])).toContain('RELIANCE');
    expect(buildEntryReadyPopupMessage([entryReadyRow, { ...entryReadyRow, symbol: 'INFY' }])).toContain('2 stocks');
  });

  it('bootstraps digest without firing on first detect', () => {
    saveEntryReadyDigest('');
    const first = detectNewEntryReadySetups([entryReadyRow], { bootstrap: true });
    expect(first.fresh).toHaveLength(0);
    const second = detectNewEntryReadySetups([entryReadyRow, { ...entryReadyRow, symbol: 'HDFCBANK' }]);
    expect(second.fresh).toHaveLength(1);
    expect(second.fresh[0].symbol).toBe('HDFCBANK');
  });
});
