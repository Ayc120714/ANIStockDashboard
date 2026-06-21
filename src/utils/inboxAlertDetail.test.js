import {
  buildInboxAlertDetail,
  extractTradeLevels,
  isLiveEntryExitAlert,
  mapLiveAlertStatus,
  shouldShowTradeLevels,
} from './inboxAlertDetail';

describe('inboxAlertDetail', () => {
  it('extracts trade levels from advisor alert raw payload', () => {
    const levels = extractTradeLevels({
      entry_price: 2800,
      stop_loss: 2750,
      target_1: 2900,
      target_2: 3000,
      signal_score: 42,
    });
    expect(levels.entry).toBe(2800);
    expect(levels.stopLoss).toBe(2750);
    expect(levels.target1).toBe(2900);
  });

  it('builds entry-ready detail from live inbox item', () => {
    const detail = buildInboxAlertDetail({
      symbol: 'RELIANCE',
      sourceLabel: 'Live advisor',
      title: 'RELIANCE entry trigger',
      subtitle: 'ENTRY_READY',
      timestamp: '2026-06-21 10:15:00',
      raw: {
        alert_type: 'ENTRY_READY',
        message: 'RELIANCE entry trigger',
        entry_price: 2800,
        stop_loss: 2750,
        target_1: 2900,
      },
    });
    expect(detail.isEntryReady).toBe(true);
    expect(detail.hasTradeLevels).toBe(true);
    expect(shouldShowTradeLevels(detail)).toBe(true);
  });

  it('maps live entry/exit alert types', () => {
    expect(isLiveEntryExitAlert({ alert_type: 'ENTRY_READY' })).toBe(true);
    expect(mapLiveAlertStatus({ alert_type: 'EXIT_READY' })).toBe('exit_watch');
  });
});
