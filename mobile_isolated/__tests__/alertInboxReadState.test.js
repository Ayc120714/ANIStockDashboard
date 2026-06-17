import {
  INBOX_SOURCES,
  countUnreadInboxItems,
  inboxItemKey,
  isAdvisorDbAlertItem,
  isInboxItemRead,
  isTableChangeInboxItem,
  mergeInboxReadKeys,
  normalizeLiveAdvisorRows,
  parseAdvisorAlertMs,
  parseInboxReadKeys,
  resolveInboxNavigationTarget,
} from '@core/utils/alertInboxUtils';

describe('notification inbox read state', () => {
  const liveItem = {
    id: '42',
    source: INBOX_SOURCES.LIVE,
    title: 'RELIANCE entry',
    isRead: false,
    raw: {is_read: false},
  };

  const tableItem = {
    id: 'trend_b1:RELIANCE:2026-06-15T10:00:00.000Z',
    source: INBOX_SOURCES.TREND_B1,
    tableKey: 'trend_b1_weekly',
    title: 'New B1',
    isRead: false,
  };

  it('keeps items read via local keys even when API returns is_read false', () => {
    const keys = new Set([inboxItemKey(liveItem)]);
    expect(isInboxItemRead(liveItem, keys)).toBe(true);
    expect(countUnreadInboxItems([liveItem], keys)).toBe(0);
  });

  it('merges stored and in-memory read keys without dropping newer marks', () => {
    const stored = parseInboxReadKeys('live:1|live:2');
    const inMemory = new Set(['live:3']);
    const merged = mergeInboxReadKeys(stored, inMemory);
    expect([...merged].sort()).toEqual(['live:1', 'live:2', 'live:3']);
  });

  it('detects DB-backed advisor alerts for server mark-read', () => {
    expect(isAdvisorDbAlertItem(liveItem)).toBe(true);
    expect(isAdvisorDbAlertItem({...liveItem, id: 'live-fallback'})).toBe(false);
    expect(isAdvisorDbAlertItem(tableItem)).toBe(false);
  });

  it('detects persisted table-change inbox items', () => {
    expect(isTableChangeInboxItem(tableItem)).toBe(true);
    expect(isTableChangeInboxItem(liveItem)).toBe(false);
  });

  it('excludes weekly cross rows from live advisor inbox bucket', () => {
    const rows = normalizeLiveAdvisorRows([
      {id: 1, alert_type: 'weekly_cross_down_mid', message: 'EOD cross', timestamp: '2026-06-15T10:00:00Z'},
      {id: 2, alert_type: 'entry_long', message: 'Entry', timestamp: '2026-06-15T09:00:00Z'},
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].source).toBe(INBOX_SOURCES.LIVE);
    expect(rows[0].id).toBe('2');
  });

  it('parses naive alert timestamps as IST wall clock', () => {
    const ms = parseAdvisorAlertMs('2026-06-15 15:30:00');
    const ist = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(ms));
    expect(ist.replace(', ', ' ')).toContain('15:30');
  });

  it('routes trend reversal inbox rows to Advisor trend tab', () => {
    expect(resolveInboxNavigationTarget(tableItem)).toEqual({
      type: 'advisor',
      advisorTab: 'trend',
      trendTf: 'weekly',
    });
  });

  it('routes chart setup inbox rows to Advisor chart tab', () => {
    expect(
      resolveInboxNavigationTarget({
        id: 'chart_daily:INFY:2026',
        source: INBOX_SOURCES.CHART_DAILY,
        title: 'Daily setup',
      }),
    ).toEqual({
      type: 'advisor',
      advisorTab: 'chart',
      trendTf: undefined,
    });
  });

  it('routes live advisor alerts to Signals tab', () => {
    expect(resolveInboxNavigationTarget(liveItem)).toEqual({type: 'signals'});
  });
});
