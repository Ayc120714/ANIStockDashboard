import {
  INBOX_SOURCES,
  HOT_ALERT_RETENTION_DAYS,
  ML_ALERT_MIN_SCORE,
  buildInboxSections,
  countUnreadInboxItems,
  filterUnreadInboxSections,
  inboxItemKey,
  isAdvisorDbAlertItem,
  isDemoAlert,
  isInboxItemRead,
  isMlHighConvictionAlert,
  isTableChangeInboxItem,
  isVwapCrossAlert,
  mergeInboxReadKeys,
  normalizeLiveAdvisorRows,
  parseAdvisorAlertMs,
  parseInboxReadKeys,
  relatedInboxReadKeys,
  resolveInboxNavigationTarget,
} from '@core/utils/alertInboxUtils';
import {
  isPushEligibleLiveAlert,
  isPushEligibleTableKey,
} from '@core/utils/pushNotificationEligibility';

function hoursAgoIso(hours) {
  return new Date(Date.now() - hours * 3600 * 1000).toISOString();
}

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

  it('hides read notifications from the inbox tab (local keys and server is_read)', () => {
    const unread = {...liveItem, id: '99', isRead: false, raw: {is_read: false}};
    const readViaKey = {...liveItem, id: '100', isRead: false, raw: {is_read: false}};
    const readViaServer = {...liveItem, id: '101', isRead: false, raw: {is_read: true}};
    const recent = hoursAgoIso(2);
    const sections = buildInboxSections({
      live: [
        {id: 99, alert_type: 'weekly_cross_up_high', message: 'Unread', timestamp: recent, is_read: false, ml_score: 0.81, source: 'ml_setup'},
        {id: 100, alert_type: 'weekly_cross_up_high', message: 'Marked read', timestamp: recent, is_read: false, ml_score: 0.81, source: 'ml_setup'},
        {id: 101, alert_type: 'weekly_cross_up_high', message: 'Server read', timestamp: recent, is_read: true, ml_score: 0.81, source: 'ml_setup'},
      ],
    });
    const readKeys = new Set([inboxItemKey(readViaKey)]);
    const display = filterUnreadInboxSections(sections, readKeys);

    expect(display.all).toHaveLength(1);
    expect(display.all[0].id).toBe('99');
    expect(display[INBOX_SOURCES.LIVE]).toHaveLength(1);
    expect(display[INBOX_SOURCES.LIVE][0].id).toBe('99');
    expect(isInboxItemRead(unread, readKeys)).toBe(false);
    expect(isInboxItemRead(readViaKey, readKeys)).toBe(true);
    expect(isInboxItemRead(readViaServer, readKeys)).toBe(true);
  });

  it('hides the weekly/special copy after the live row is marked read', () => {
    const recent = hoursAgoIso(1);
    const sections = buildInboxSections({
      live: [
        {id: 91, alert_type: 'weekly_cross_up_high', message: 'ICIL high', timestamp: recent, is_read: false, ml_score: 0.7, source: 'ml_setup', symbol: 'ICIL'},
      ],
      special: [
        {id: 91, alert_type: 'weekly_cross_up_high', message: 'ICIL high', timestamp: recent, symbol: 'ICIL'},
      ],
    });
    const liveRow = sections[INBOX_SOURCES.LIVE][0];
    const readKeys = new Set(relatedInboxReadKeys(liveRow));
    const display = filterUnreadInboxSections(sections, readKeys);
    expect(display[INBOX_SOURCES.LIVE]).toHaveLength(0);
    expect(display[INBOX_SOURCES.WEEKLY]).toHaveLength(0);
    expect(display.all).toHaveLength(0);
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

  it('keeps ML weekly_cross in live inbox and drops unscored EOD weekly crosses', () => {
    const recent = hoursAgoIso(1);
    const rows = normalizeLiveAdvisorRows([
      {id: 1, alert_type: 'weekly_cross_down_mid', message: 'EOD cross', timestamp: recent},
      {id: 2, alert_type: 'weekly_cross_up_high', message: 'ML', timestamp: recent, ml_score: 0.81, source: 'ml_setup'},
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

  it('routes live advisor alerts to Alerts screen', () => {
    expect(resolveInboxNavigationTarget(liveItem)).toEqual({type: 'alerts'});
  });

  it('routes price alerts to Alerts screen (not Signals)', () => {
    expect(
      resolveInboxNavigationTarget({
        id: 'price:1',
        source: INBOX_SOURCES.PRICE,
        title: 'RELIANCE crossed threshold',
      }),
    ).toEqual({type: 'alerts'});
  });

  it('detects demo test alerts and drops them from live inbox rows', () => {
    expect(isDemoAlert({source: 'demo', symbol: 'DEMO', alert_type: 'demo_mobile_test'})).toBe(true);
    expect(normalizeLiveAdvisorRows([
      {id: 1, symbol: 'RELIANCE', alert_type: 'renko_smart_long', timestamp: hoursAgoIso(1), ml_score: 0.74, source: 'ml_setup'},
      {id: 2, symbol: 'DEMO', alert_type: 'demo_mobile_test', source: 'demo', timestamp: hoursAgoIso(1), ml_score: 0.99},
    ])).toHaveLength(1);
  });
});

describe('ML high-conviction live alerts (score >= 0.70, last 3 days, no VWAP)', () => {
  it('keeps the 3-day hot window and 0.70 score floor', () => {
    expect(HOT_ALERT_RETENTION_DAYS).toBe(3);
    expect(ML_ALERT_MIN_SCORE).toBe(0.7);
  });

  it('drops VWAP cross, stale, and sub-70 ML rows from the live inbox', () => {
    const kept = normalizeLiveAdvisorRows([
      {id: 1, symbol: 'HAL', alert_type: 'weekly_cross_up_high', timestamp: hoursAgoIso(6), ml_score: 0.81, source: 'ml_setup'},
      {id: 6, symbol: 'VARROC', alert_type: 'weekly_cross_up_mid', timestamp: hoursAgoIso(3), ml_score: 0.74, source: 'ml_setup'},
      {id: 2, symbol: 'TCS', alert_type: 'vwap_cross_above', timestamp: hoursAgoIso(1), ml_score: 0.99, source: 'ml_setup'},
      {id: 3, symbol: 'INFY', alert_type: 'unusual_volume', timestamp: hoursAgoIso(6), ml_score: 0.69, source: 'ml_setup'},
      {id: 4, symbol: 'SBIN', alert_type: 'renko_smart_long', timestamp: hoursAgoIso(24 * 4), ml_score: 0.91, source: 'ml_setup'},
      {id: 5, symbol: 'ITC', alert_type: 'ENTRY_READY', timestamp: hoursAgoIso(2), source: 'intraday'},
    ]);
    expect(kept.map(row => row.id)).toEqual(['6', '1']);
    expect(isVwapCrossAlert({alert_type: 'vwap_cross_below'})).toBe(true);
  });

  it('treats percent scores such as 74 as 0.74 for enabled families', () => {
    expect(isMlHighConvictionAlert({alert_type: 'renko_smart_long', ml_score: 74, source: 'ml_setup'})).toBe(true);
    expect(isMlHighConvictionAlert({alert_type: 'weekly_cross_up_high', signal_detail: {ml_score: 0.7}})).toBe(true);
    expect(isMlHighConvictionAlert({alert_type: 'unusual_volume', ml_score: 0.8, vol_ratio: 2.2})).toBe(true);
    expect(isMlHighConvictionAlert({alert_type: 'unusual_volume', ml_score: 0.8, vol_ratio: 1.5})).toBe(false);
    expect(isMlHighConvictionAlert({alert_type: 'weekly_cross_up_low', ml_score: 0.8, source: 'ml_setup'})).toBe(true);
    expect(isMlHighConvictionAlert({alert_type: 'weekly_cross_up_mid', ml_score: 0.8, source: 'ml_setup'})).toBe(true);
    expect(isMlHighConvictionAlert({alert_type: 'macd_bull', ml_score: 74, source: 'ml_setup'})).toBe(false);
    expect(isMlHighConvictionAlert({alert_type: 'renko_smart_long', ml_score: 0.699})).toBe(false);
  });

  it('vibrates only for ML score >= 0.70, never Renko/ENTRY_READY/VWAP without that score', () => {
    expect(isPushEligibleLiveAlert({alert_type: 'weekly_cross_up_low', ml_score: 0.7, source: 'ml_setup'})).toBe(true);
    expect(isPushEligibleLiveAlert({alert_type: 'weekly_cross_up_mid', ml_score: 0.7, source: 'ml_setup'})).toBe(true);
    expect(isPushEligibleLiveAlert({alert_type: 'weekly_cross_up_high', ml_score: 0.7, source: 'ml_setup'})).toBe(true);
    expect(isPushEligibleLiveAlert({alert_type: 'renko_smart_long', symbol: 'SBIN'})).toBe(false);
    expect(isPushEligibleLiveAlert({alert_type: 'ENTRY_READY', symbol: 'INFY'})).toBe(false);
    expect(isPushEligibleLiveAlert({alert_type: 'vwap_cross_above', ml_score: 0.99})).toBe(false);
    expect(isPushEligibleTableKey('renko_smart')).toBe(false);
    expect(isPushEligibleTableKey('trend_b1_weekly')).toBe(false);
  });
});
