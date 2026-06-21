/** Normalize and group alerts for the mobile notification inbox (web StockAlerts parity). */

export const NOTIFICATION_TIMEZONE = 'Asia/Kolkata';
export const IST_OFFSET = '+05:30';

export const INBOX_SOURCES = {
  LIVE: 'live',
  WEEKLY: 'weekly_cross',
  DIVERGENCE: 'rsi_divergence',
  PRICE: 'price',
  ADMIN: 'admin',
  SIG_MONTHLY: 'sig_monthly',
  SIG_CUSTOM: 'sig_custom',
  SIG_MONDAY: 'sig_monday',
  SIG_B1: 'sig_b1',
  SIG_B2: 'sig_b2',
  SIG_B3: 'sig_b3',
  SIG_S1: 'sig_s1',
  SIG_S2: 'sig_s2',
  SIG_S3: 'sig_s3',
  TREND_B1: 'trend_b1',
  TREND_B2: 'trend_b2',
  TREND_B3: 'trend_b3',
  TREND_S1: 'trend_s1',
  TREND_S2: 'trend_s2',
  TREND_S3: 'trend_s3',
  CHART_DAILY: 'chart_daily',
  CHART_WEEKLY: 'chart_weekly',
  CHART_MONTHLY: 'chart_monthly',
  PRICE_MOVERS: 'price_movers',
  VOLUME_MOVERS: 'volume_movers',
};

export const INBOX_SOURCE_LABELS = {
  [INBOX_SOURCES.LIVE]: 'Live advisor',
  [INBOX_SOURCES.WEEKLY]: 'Weekly cross',
  [INBOX_SOURCES.DIVERGENCE]: 'RSI divergence',
  [INBOX_SOURCES.PRICE]: 'Price alert',
  [INBOX_SOURCES.ADMIN]: 'Admin',
  [INBOX_SOURCES.SIG_MONTHLY]: 'Monthly MACD',
  [INBOX_SOURCES.SIG_CUSTOM]: 'Custom RS/MACD',
  [INBOX_SOURCES.SIG_MONDAY]: 'Monday PWH',
  [INBOX_SOURCES.SIG_B1]: 'Signals B1',
  [INBOX_SOURCES.SIG_B2]: 'Signals B2',
  [INBOX_SOURCES.SIG_B3]: 'Signals B3',
  [INBOX_SOURCES.SIG_S1]: 'Signals S1',
  [INBOX_SOURCES.SIG_S2]: 'Signals S2',
  [INBOX_SOURCES.SIG_S3]: 'Signals S3',
  [INBOX_SOURCES.TREND_B1]: 'Trend B1',
  [INBOX_SOURCES.TREND_B2]: 'Trend B2',
  [INBOX_SOURCES.TREND_B3]: 'Trend B3',
  [INBOX_SOURCES.TREND_S1]: 'Trend S1',
  [INBOX_SOURCES.TREND_S2]: 'Trend S2',
  [INBOX_SOURCES.TREND_S3]: 'Trend S3',
  [INBOX_SOURCES.CHART_DAILY]: 'Chart daily',
  [INBOX_SOURCES.CHART_WEEKLY]: 'Chart weekly',
  [INBOX_SOURCES.CHART_MONTHLY]: 'Chart monthly',
  [INBOX_SOURCES.PRICE_MOVERS]: 'Price movers',
  [INBOX_SOURCES.VOLUME_MOVERS]: 'Volume movers',
};

export const INBOX_FILTER_CHIPS = [
  {id: 'all', label: 'All'},
  {id: INBOX_SOURCES.LIVE, label: 'Live'},
  {id: INBOX_SOURCES.WEEKLY, label: 'Weekly cross'},
  {id: INBOX_SOURCES.DIVERGENCE, label: 'RSI div'},
  {id: INBOX_SOURCES.PRICE, label: 'Price alert'},
  {id: INBOX_SOURCES.SIG_MONTHLY, label: 'Monthly MACD'},
  {id: INBOX_SOURCES.SIG_CUSTOM, label: 'Custom RS'},
  {id: INBOX_SOURCES.SIG_MONDAY, label: 'Monday PWH'},
  {id: INBOX_SOURCES.SIG_B1, label: 'Sig B1'},
  {id: INBOX_SOURCES.SIG_B2, label: 'Sig B2'},
  {id: INBOX_SOURCES.SIG_B3, label: 'Sig B3'},
  {id: INBOX_SOURCES.SIG_S1, label: 'Sig S1'},
  {id: INBOX_SOURCES.SIG_S2, label: 'Sig S2'},
  {id: INBOX_SOURCES.SIG_S3, label: 'Sig S3'},
  {id: INBOX_SOURCES.TREND_B1, label: 'B1'},
  {id: INBOX_SOURCES.TREND_B2, label: 'B2'},
  {id: INBOX_SOURCES.TREND_B3, label: 'B3'},
  {id: INBOX_SOURCES.TREND_S1, label: 'S1'},
  {id: INBOX_SOURCES.TREND_S2, label: 'S2'},
  {id: INBOX_SOURCES.TREND_S3, label: 'S3'},
  {id: INBOX_SOURCES.CHART_DAILY, label: 'D setup'},
  {id: INBOX_SOURCES.CHART_WEEKLY, label: 'W setup'},
  {id: INBOX_SOURCES.CHART_MONTHLY, label: 'M setup'},
  {id: INBOX_SOURCES.PRICE_MOVERS, label: 'Price movers'},
  {id: INBOX_SOURCES.VOLUME_MOVERS, label: 'Volume movers'},
  {id: INBOX_SOURCES.ADMIN, label: 'Admin'},
];

const dateKeyIST = d =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: NOTIFICATION_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);

/** True for mobile notification test rows — never push or show in live UI. */
export function isDemoAlert(row) {
  if (!row || typeof row !== 'object') return false;
  if (row._demo === true) return true;
  const source = String(row?.source || '').trim().toLowerCase();
  if (source === 'demo') return true;
  const symbol = String(row?.symbol || '').trim().toUpperCase();
  if (symbol === 'DEMO') return true;
  const alertType = String(row?.alert_type || '').trim().toLowerCase();
  if (alertType.includes('demo')) return true;
  const detail = row?.signal_detail;
  if (detail && typeof detail === 'object' && detail.demo === true) return true;
  const message = String(row?.message || '').trim().toUpperCase();
  if (message.startsWith('[DEMO]')) return true;
  return false;
}

export function parseAdvisorAlertMs(ts) {
  if (ts == null || ts === '') return 0;
  const s = String(ts).trim();
  const isoLike = s.includes('T') ? s : s.replace(/^(\d{4}-\d{2}-\d{2})\s+/, '$1T');
  const hasZone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(isoLike);
  const normalized = hasZone ? isoLike : `${isoLike}${IST_OFFSET}`;
  const ms = Date.parse(normalized);
  return Number.isFinite(ms) ? ms : 0;
}

export function isTodayInIST(value) {
  const ms = parseAdvisorAlertMs(value);
  if (!ms) return false;
  return dateKeyIST(new Date(ms)) === dateKeyIST(new Date());
}

export function formatAlertTimeIST(ts) {
  const ms = parseAdvisorAlertMs(ts);
  if (!ms) return ts ? String(ts).replace('T', ' ').slice(0, 19) : '—';
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: NOTIFICATION_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
      .format(new Date(ms))
      .replace(', ', ' ');
  } catch {
    return String(ts).slice(0, 19);
  }
}

export function categorizeAdvisorAlertType(alertType) {
  const t = String(alertType || '').toLowerCase();
  if (t.startsWith('weekly_cross_')) return INBOX_SOURCES.WEEKLY;
  if (t.startsWith('rsi_divergence_')) return INBOX_SOURCES.DIVERGENCE;
  return INBOX_SOURCES.LIVE;
}

function normalizeAdvisorRow(row, source) {
  const id = String(row?.id || `${row?.symbol || 'row'}_${row?.alert_type || source}`);
  const ts = row?.timestamp || row?.triggered_at || row?.created_at;
  return {
    id,
    source,
    sourceLabel: INBOX_SOURCE_LABELS[source] || source,
    symbol: String(row?.symbol || row?.tradingSymbol || '').trim().toUpperCase() || '—',
    title: String(row?.message || row?.alert_type || row?.title || 'Alert').trim(),
    subtitle: String(row?.alert_type || row?.direction || row?.severity || '').trim(),
    timestamp: ts,
    timestampMs: parseAdvisorAlertMs(ts),
    isRead: Boolean(row?.is_read),
    raw: row,
  };
}

export function normalizeLiveAdvisorRows(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .filter(row => {
      if (isDemoAlert(row)) return false;
      const t = String(row?.alert_type || '').toLowerCase();
      return !t.startsWith('weekly_cross_') && !t.startsWith('rsi_divergence_');
    })
    .map(row => normalizeAdvisorRow(row, INBOX_SOURCES.LIVE))
    .sort((a, b) => b.timestampMs - a.timestampMs);
}

export function normalizeSpecialAdvisorRows(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .map(row => normalizeAdvisorRow(row, categorizeAdvisorAlertType(row?.alert_type)))
    .sort((a, b) => b.timestampMs - a.timestampMs);
}

export function normalizePriceTriggerRows(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .filter(row => isTodayInIST(row?.triggered_at))
    .map(row =>
      normalizeAdvisorRow(
        {
          ...row,
          id: row?.id,
          message: row?.message || `${row?.direction || 'Alert'} @ ${row?.trigger_price ?? row?.threshold_price ?? '—'}`,
          alert_type: `price_${String(row?.list_type || 'alert').toLowerCase()}`,
        },
        INBOX_SOURCES.PRICE,
      ),
    )
    .sort((a, b) => b.timestampMs - a.timestampMs);
}

export function normalizeAdminNotificationRows(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .map(row =>
      normalizeAdvisorRow(
        {
          ...row,
          symbol: row?.subject_user_email || row?.subject_user_id || 'Admin',
          message: row?.body || row?.title,
          alert_type: row?.notification_type || 'admin',
          timestamp: row?.created_at,
        },
        INBOX_SOURCES.ADMIN,
      ),
    )
    .sort((a, b) => b.timestampMs - a.timestampMs);
}

export function normalizeTableChangeEventRows(events = []) {
  return (Array.isArray(events) ? events : [])
    .map(event =>
      normalizeAdvisorRow(
        {
          ...event,
          message: event?.title || event?.sourceLabel,
          alert_type: event?.tableKey || event?.source,
          advisorTab: event?.advisorTab,
          screensMain: event?.screensMain,
          trendTf: event?.trendTf,
        },
        event?.source,
      ),
    )
    .sort((a, b) => b.timestampMs - a.timestampMs);
}

export function buildInboxSections({
  live = [],
  special = [],
  price = [],
  admin = [],
  tableEvents = [],
} = {}) {
  const liveRows = normalizeLiveAdvisorRows(live);
  const specialRows = normalizeSpecialAdvisorRows(special);
  const weekly = specialRows.filter(r => r.source === INBOX_SOURCES.WEEKLY);
  const divergence = specialRows.filter(r => r.source === INBOX_SOURCES.DIVERGENCE);
  const priceRows = normalizePriceTriggerRows(price);
  const adminRows = normalizeAdminNotificationRows(admin);
  const tableRows = normalizeTableChangeEventRows(tableEvents);

  const tableOnlySources = [
    INBOX_SOURCES.SIG_MONTHLY,
    INBOX_SOURCES.SIG_CUSTOM,
    INBOX_SOURCES.SIG_MONDAY,
    INBOX_SOURCES.SIG_B1,
    INBOX_SOURCES.SIG_B2,
    INBOX_SOURCES.SIG_B3,
    INBOX_SOURCES.SIG_S1,
    INBOX_SOURCES.SIG_S2,
    INBOX_SOURCES.SIG_S3,
    INBOX_SOURCES.TREND_B1,
    INBOX_SOURCES.TREND_B2,
    INBOX_SOURCES.TREND_B3,
    INBOX_SOURCES.TREND_S1,
    INBOX_SOURCES.TREND_S2,
    INBOX_SOURCES.TREND_S3,
    INBOX_SOURCES.CHART_DAILY,
    INBOX_SOURCES.CHART_WEEKLY,
    INBOX_SOURCES.CHART_MONTHLY,
    INBOX_SOURCES.PRICE_MOVERS,
    INBOX_SOURCES.VOLUME_MOVERS,
  ];

  const sections = {
    all: [
      ...liveRows,
      ...weekly,
      ...divergence,
      ...priceRows,
      ...adminRows,
      ...tableRows,
    ].sort((a, b) => b.timestampMs - a.timestampMs),
    [INBOX_SOURCES.LIVE]: liveRows,
    [INBOX_SOURCES.WEEKLY]: weekly,
    [INBOX_SOURCES.DIVERGENCE]: divergence,
    [INBOX_SOURCES.PRICE]: priceRows,
    [INBOX_SOURCES.ADMIN]: adminRows,
  };

  for (const source of tableOnlySources) {
    sections[source] = tableRows.filter(r => r.source === source);
  }

  return sections;
}

export function inboxItemKey(item) {
  return `${item?.source || 'row'}:${item?.id || item?.title || ''}`;
}

export function parseInboxReadKeys(stored = '') {
  return new Set(String(stored || '').split('|').filter(Boolean));
}

export function serializeInboxReadKeys(keys) {
  const list = keys instanceof Set ? [...keys] : Array.isArray(keys) ? keys : [];
  return list.sort().join('|');
}

export function mergeInboxReadKeys(...sources) {
  const merged = new Set();
  for (const source of sources) {
    if (!source) continue;
    const keys = source instanceof Set ? source : parseInboxReadKeys(source);
    for (const key of keys) merged.add(key);
  }
  return merged;
}

/** DB-backed advisor alerts (live, weekly cross, RSI divergence) with stable numeric ids. */
export function isAdvisorDbAlertItem(item) {
  if (!item?.id) return false;
  const source = item?.source;
  if (
    source !== INBOX_SOURCES.LIVE
    && source !== INBOX_SOURCES.WEEKLY
    && source !== INBOX_SOURCES.DIVERGENCE
  ) {
    return false;
  }
  return /^\d+$/.test(String(item.id));
}

const TABLE_CHANGE_SOURCE_SET = new Set([
  INBOX_SOURCES.SIG_MONTHLY,
  INBOX_SOURCES.SIG_CUSTOM,
  INBOX_SOURCES.SIG_MONDAY,
  INBOX_SOURCES.SIG_B1,
  INBOX_SOURCES.SIG_B2,
  INBOX_SOURCES.SIG_B3,
  INBOX_SOURCES.SIG_S1,
  INBOX_SOURCES.SIG_S2,
  INBOX_SOURCES.SIG_S3,
  INBOX_SOURCES.TREND_B1,
  INBOX_SOURCES.TREND_B2,
  INBOX_SOURCES.TREND_B3,
  INBOX_SOURCES.TREND_S1,
  INBOX_SOURCES.TREND_S2,
  INBOX_SOURCES.TREND_S3,
  INBOX_SOURCES.CHART_DAILY,
  INBOX_SOURCES.CHART_WEEKLY,
  INBOX_SOURCES.CHART_MONTHLY,
  INBOX_SOURCES.PRICE_MOVERS,
  INBOX_SOURCES.VOLUME_MOVERS,
]);

export function isTableChangeInboxItem(item) {
  return TABLE_CHANGE_SOURCE_SET.has(item?.source);
}

/**
 * Resolve where an inbox row should navigate (Advisor sub-tab, Screens, Signals, or Stocks alerts).
 * Falls back to source metadata when persisted events omit advisorTab on raw.
 */
export function resolveInboxNavigationTarget(item) {
  const {ADVISOR_TABLE_META, INBOX_SOURCE_NAV_TARGETS} = require('@core/utils/advisorTableSnapshots');
  const raw = item?.raw || item || {};
  const tableKey = raw.tableKey || item?.tableKey;
  const tableMeta = tableKey ? ADVISOR_TABLE_META[tableKey] : null;
  if (tableMeta?.screensMain) {
    return {type: 'screens', screensMain: tableMeta.screensMain};
  }
  if (tableMeta?.advisorTab) {
    return {
      type: 'advisor',
      advisorTab: tableMeta.advisorTab,
      trendTf: tableMeta.trendTf,
    };
  }
  if (raw.screensMain) {
    return {type: 'screens', screensMain: raw.screensMain};
  }
  const advisorTab = raw.advisorTab || item?.advisorTab;
  if (advisorTab) {
    return {
      type: 'advisor',
      advisorTab,
      trendTf: raw.trendTf || item?.trendTf,
    };
  }
  const fromSource = INBOX_SOURCE_NAV_TARGETS[item?.source];
  if (fromSource?.screensMain) {
    return {type: 'screens', screensMain: fromSource.screensMain};
  }
  if (fromSource?.advisorTab) {
    return {
      type: 'advisor',
      advisorTab: fromSource.advisorTab,
      trendTf: fromSource.trendTf,
    };
  }
  if (item?.source === INBOX_SOURCES.LIVE) {
    return {type: 'alerts'};
  }
  if (item?.source === INBOX_SOURCES.PRICE) {
    return {type: 'alerts'};
  }
  return {type: 'signals'};
}

export function isInboxItemRead(item, readKeys) {
  const keys = readKeys instanceof Set ? readKeys : parseInboxReadKeys(readKeys);
  if (keys.has(inboxItemKey(item))) return true;
  if (Boolean(item?.isRead)) return true;
  if (Boolean(item?.raw?.is_read)) return true;
  return false;
}

export function applyInboxReadState(items = [], readKeys) {
  return (Array.isArray(items) ? items : []).map(item => ({
    ...item,
    isRead: isInboxItemRead(item, readKeys),
  }));
}

export function applyInboxReadStateToSections(sections = {}, readKeys) {
  const next = {};
  for (const [key, items] of Object.entries(sections)) {
    next[key] = applyInboxReadState(items, readKeys);
  }
  return next;
}

/** Inbox UI: apply read state and drop read rows so the notifications tab shows unread only. */
export function filterUnreadInboxSections(sections = {}, readKeys) {
  const withReadState = applyInboxReadStateToSections(sections, readKeys);
  const next = {};
  for (const [key, items] of Object.entries(withReadState)) {
    next[key] = (items || []).filter(item => !item.isRead);
  }
  return next;
}

export function inboxDigest(items = []) {
  return (Array.isArray(items) ? items : [])
    .map(inboxItemKey)
    .sort()
    .join('|');
}

export function countUnreadInboxItems(items = [], readKeys = '') {
  const keys = readKeys instanceof Set ? readKeys : parseInboxReadKeys(readKeys);
  return (Array.isArray(items) ? items : []).filter(item => !isInboxItemRead(item, keys)).length;
}
