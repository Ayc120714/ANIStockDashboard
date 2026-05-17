/**
 * Early-detection advisor table: normalize public API rows, SQZ filters, sort.
 * Proprietary rule parameters are not exposed by the API.
 */

export const SQZ_SET_ORDER = { brown: 0, lime: 1, green: 2, unknown: 3 };

/** Calendar days for API recent window (2 days / 2 weeks / 2 months). */
export function recentLookbackDaysForTimeframe(timeframe) {
  const tf = String(timeframe || 'daily').toLowerCase();
  if (tf === 'weekly') return 14;
  if (tf === 'monthly') return 62;
  return 2;
}

export function recentWindowDates(timeframe) {
  const tf = String(timeframe || 'daily').toLowerCase();
  const today = new Date();
  const pad = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const to = new Date(today);
  const from = new Date(today);
  from.setDate(from.getDate() - recentLookbackDaysForTimeframe(tf));
  return { from: pad(from), to: pad(to) };
}

export function defaultHistoryDateRange(timeframe) {
  const tf = String(timeframe || 'daily').toLowerCase();
  const today = new Date();
  const pad = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const to = new Date(today);
  const from = new Date(today);
  if (tf === 'weekly') {
    to.setDate(to.getDate() - 15);
    from.setDate(from.getDate() - 365);
  } else if (tf === 'monthly') {
    to.setDate(to.getDate() - 63);
    from.setDate(from.getDate() - 730);
  } else {
    to.setDate(to.getDate() - 3);
    from.setDate(from.getDate() - 120);
  }
  return { from: pad(from), to: pad(to) };
}

const VALID_SQZ_SETS = new Set(['brown', 'lime', 'green']);
const STATUS_ORDER = { confirmed: 0, active: 1, watch: 2 };

export function sqzColorToSet(color) {
  const c = String(color || '').trim().toLowerCase();
  if (c === 'brown') return 'brown';
  if (c === 'lime') return 'lime';
  if (c === 'light_green' || c === 'green') return 'green';
  return null;
}

export function parseEdNumber(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function earlyDetectionStatusLabel(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'confirmed') return 'Confirmed';
  if (s === 'active') return 'Active';
  if (s === 'watch') return 'Watch';
  return '—';
}

function triggerToMs(triggerDate) {
  if (!triggerDate) return 0;
  const s = String(triggerDate).slice(0, 10);
  const t = Date.parse(`${s}T00:00:00`);
  return Number.isFinite(t) ? t : 0;
}

function resolveStatus(row, emaOk) {
  const apiStatus = String(row?.status || '').toLowerCase();
  if (apiStatus === 'confirmed' || apiStatus === 'active' || apiStatus === 'watch') {
    return apiStatus;
  }
  if (emaOk || row?.is_full_six_step) return 'confirmed';
  if (row?.trigger_date) return 'active';
  return 'watch';
}

/**
 * Normalize one public API row.
 */
export function normalizeEarlyDetectionRow(row) {
  const symbol = String(row?.symbol || '').trim().toUpperCase();
  const sqzColor = row?.sqz_color ? String(row.sqz_color).toLowerCase() : null;
  let sqzSet = String(row?.sqz_set || '').trim().toLowerCase();
  if (!VALID_SQZ_SETS.has(sqzSet)) {
    sqzSet = sqzColorToSet(sqzColor) || '';
  }

  const close = parseEdNumber(row?.close);
  const emaFast = parseEdNumber(row?.ema_fast ?? row?.ema100);
  const emaSlow = parseEdNumber(row?.ema_slow ?? row?.ema200);
  const rvol = parseEdNumber(row?.rvol);

  const emaOk =
    row?.ema_ok != null
      ? Boolean(row.ema_ok)
      : close != null && emaFast != null && emaSlow != null && close > emaFast && close > emaSlow;

  const status = resolveStatus(row, emaOk);
  const hasTrigger = Boolean(row?.trigger_date);
  const isComplete = hasTrigger && (status === 'confirmed' || status === 'active');

  return {
    ...row,
    symbol,
    sector: row?.sector ? String(row.sector) : '',
    timeframe: row?.timeframe ? String(row.timeframe) : 'daily',
    trigger_date: row?.trigger_date ? String(row.trigger_date).slice(0, 10) : null,
    trigger_ts: triggerToMs(row?.trigger_date),
    status,
    status_label: earlyDetectionStatusLabel(status),
    sqz_color: sqzColor,
    sqz_set: sqzSet,
    rvol,
    close,
    ema_fast: emaFast,
    ema_slow: emaSlow,
    ema_ok: emaOk,
    is_complete: isComplete,
    is_legacy: !hasTrigger,
  };
}

export function normalizeEarlyDetectionRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map(normalizeEarlyDetectionRow).filter((r) => r.symbol);
}

export function filterEarlyDetectionRows(rows, sqzFilter = 'all', { includeLegacy = false } = {}) {
  const want = String(sqzFilter || 'all').trim().toLowerCase();
  return rows.filter((r) => {
    if (!includeLegacy && r.is_legacy) return false;
    if (!r.is_complete) return false;
    if (want === 'all' || !want) return true;
    return r.sqz_set === want;
  });
}

export function countEarlyDetectionBySqzSet(rows) {
  const complete = rows.filter((r) => r.is_complete);
  const counts = {
    all: complete.length,
    brown: 0,
    lime: 0,
    green: 0,
    unknown: 0,
    legacy: rows.filter((r) => !r.is_complete).length,
    pending_confirm: complete.filter((r) => r.status === 'active').length,
  };
  for (const r of complete) {
    if (r.sqz_set === 'brown') counts.brown += 1;
    else if (r.sqz_set === 'lime') counts.lime += 1;
    else if (r.sqz_set === 'green') counts.green += 1;
    else counts.unknown += 1;
  }
  return counts;
}

function cmpNullable(a, b, mul) {
  const na = a == null;
  const nb = b == null;
  if (na && nb) return 0;
  if (na) return 1;
  if (nb) return -1;
  if (a < b) return -1 * mul;
  if (a > b) return 1 * mul;
  return 0;
}

function cmpString(a, b, mul) {
  return String(a || '').localeCompare(String(b || ''), undefined, { sensitivity: 'base' }) * mul;
}

export function sortEarlyDetectionRows(rows, sortCol, sortDir) {
  const col = String(sortCol || 'trigger_date').toLowerCase();
  const mul = String(sortDir || 'desc').toLowerCase() === 'asc' ? 1 : -1;
  const sorted = [...rows];

  sorted.sort((a, b) => {
    let c = 0;
    switch (col) {
      case 'symbol':
        c = cmpString(a.symbol, b.symbol, 1);
        break;
      case 'sector':
        c = cmpString(a.sector, b.sector, 1);
        break;
      case 'trigger_date':
        c = cmpNullable(a.trigger_ts, b.trigger_ts, 1);
        break;
      case 'status':
        c = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
        break;
      case 'rvol':
        c = cmpNullable(a.rvol, b.rvol, 1);
        break;
      case 'sqz_set':
        c =
          (SQZ_SET_ORDER[a.sqz_set] ?? SQZ_SET_ORDER.unknown) -
          (SQZ_SET_ORDER[b.sqz_set] ?? SQZ_SET_ORDER.unknown);
        break;
      case 'close':
        c = cmpNullable(a.close, b.close, 1);
        break;
      case 'ema_fast':
      case 'ema100':
        c = cmpNullable(a.ema_fast, b.ema_fast, 1);
        break;
      case 'ema_slow':
      case 'ema200':
        c = cmpNullable(a.ema_slow, b.ema_slow, 1);
        break;
      default:
        c = cmpNullable(a.trigger_ts, b.trigger_ts, 1);
    }
    if (c !== 0) return c * mul;
    return cmpString(a.symbol, b.symbol, 1);
  });

  return sorted;
}

export function buildEarlyDetectionTableModel(rawRows, { sqzFilter, sortCol, sortDir } = {}) {
  const normalized = normalizeEarlyDetectionRows(rawRows);
  const counts = countEarlyDetectionBySqzSet(normalized);
  const filtered = filterEarlyDetectionRows(normalized, sqzFilter);
  const sorted = sortEarlyDetectionRows(filtered, sortCol, sortDir);
  return { normalized, counts, filtered, sorted };
}
