/** Display helpers for the admin-only weekly OC expiry analysis tab. */

export const INDEX_ANALYSIS_SYMBOLS = [
  { symbol: 'NIFTY', display_name: 'Nifty 50', kind: 'index' },
  { symbol: 'BANKNIFTY', display_name: 'Nifty Bank', kind: 'index' },
];

export const EXPIRY_SYMBOL_MIN_QUERY_CHARS = 1;
export const EXPIRY_SYMBOL_MAX_RESULTS = 50;

export function coarseBinColor(lo, hi) {
  const mid =
    hi == null ? Number(lo ?? 0) + 1 : lo == null ? Number(hi ?? 0) - 1 : (Number(lo) + Number(hi)) / 2;
  if (mid >= 4) return '#16a34a';
  if (mid >= 2) return '#22c55e';
  if (mid >= 0) return '#86efac';
  if (mid >= -2) return '#fdba74';
  if (mid >= -4) return '#f97316';
  return '#dc2626';
}

export function formatOcPct(value) {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

export function newsNameForSymbol(symbol) {
  const compact = String(symbol || '')
    .toUpperCase()
    .replace(/[\s_-]/g, '');
  if (compact === 'NIFTY' || compact === 'NIFTY50') return 'Nifty 50';
  if (compact === 'BANKNIFTY' || compact === 'NIFTYBANK') return 'Bank Nifty';
  return String(symbol || '').trim().toUpperCase() || 'Nifty 50';
}

export function defaultNewsKeywords(ocReturn, symbol = 'NIFTY') {
  const name = newsNameForSymbol(symbol);
  const n = Number(ocReturn);
  if (Number.isFinite(n) && n < 0) {
    return `${name} fall OR drop OR slump OR crash OR decline`;
  }
  return `${name} rally OR surge OR rise OR jump OR gain`;
}

export function outlierPointColor(kind) {
  if (kind === 'upside') return '#22c55e';
  if (kind === 'downside') return '#ef4444';
  return '#6b7280';
}

export function filterExpirySymbolOptions(opts, inputValue, {
  minChars = EXPIRY_SYMBOL_MIN_QUERY_CHARS,
  maxResults = EXPIRY_SYMBOL_MAX_RESULTS,
} = {}) {
  const list = Array.isArray(opts) ? opts : [];
  const q = String(inputValue || '').trim().toLowerCase();
  if (q.length < minChars) return [];
  const matched = [];
  for (const opt of list) {
    const symbol = String(opt?.symbol || opt || '');
    const display = String(opt?.display_name || '');
    const sector = String(opt?.sector || '');
    if (
      symbol.toLowerCase().includes(q)
      || display.toLowerCase().includes(q)
      || sector.toLowerCase().includes(q)
    ) {
      matched.push(opt);
      if (matched.length >= maxResults) break;
    }
  }
  return matched;
}

export const OUTLIER_FILTERS = ['all', 'upside', 'downside', 'within'];
export const OUTLIER_FILTER_LABELS = {
  all: 'All',
  upside: 'Upside',
  downside: 'Downside',
  within: 'Within',
};
export const UNIVERSE_SORT_KEYS = ['ml_setup_count', 'oc_return', 'outlier', 'symbol', 'period_count'];
export const UNIVERSE_SORT_LABELS = {
  ml_setup_count: 'ML setups',
  oc_return: 'This week OC',
  outlier: 'Outlier',
  symbol: 'Symbol',
  period_count: 'Weeks',
};
const OUTLIER_RANK = { downside: 0, within: 1, upside: 2 };

export function nextUniverseSort(currentKey, currentDir, nextKey) {
  const key = UNIVERSE_SORT_KEYS.includes(nextKey) ? nextKey : 'ml_setup_count';
  if (currentKey === key) {
    return { sortKey: key, sortDir: currentDir === 'asc' ? 'desc' : 'asc' };
  }
  const sortDir = key === 'symbol' || key === 'outlier' ? 'asc' : 'desc';
  return { sortKey: key, sortDir };
}

export function filterAndSortUniverseRows(rows, {
  outlier = 'all',
  sortKey = 'ml_setup_count',
  sortDir = 'desc',
} = {}) {
  const list = Array.isArray(rows) ? [...rows] : [];
  const wanted = String(outlier || 'all');
  const filtered = wanted === 'all'
    ? list
    : list.filter((row) => String(row?.outlier_kind || 'within') === wanted);
  const dir = sortDir === 'asc' ? 1 : -1;
  const key = UNIVERSE_SORT_KEYS.includes(sortKey) ? sortKey : 'ml_setup_count';
  filtered.sort((a, b) => {
    let cmp = 0;
    if (key === 'ml_setup_count' || key === 'period_count' || key === 'oc_return') {
      cmp = Number(a?.[key] || 0) - Number(b?.[key] || 0);
    } else if (key === 'outlier') {
      cmp = (OUTLIER_RANK[a?.outlier_kind] ?? 1) - (OUTLIER_RANK[b?.outlier_kind] ?? 1);
    } else {
      cmp = String(a?.display_name || a?.symbol || '').localeCompare(String(b?.display_name || b?.symbol || ''));
    }
    if (cmp === 0) {
      cmp = String(a?.symbol || '').localeCompare(String(b?.symbol || ''));
    }
    return cmp * dir;
  });
  return filtered;
}

export function fineBinLabel(ocReturn) {
  const value = Number(ocReturn);
  if (!Number.isFinite(value) || value === 0) return null;
  const bucket = Math.floor(value / 0.1);
  const lo = bucket * 0.1;
  const hi = lo + 0.1;
  return `${lo.toFixed(1)}% to ${hi.toFixed(1)}%`;
}

export function weeksWithSetupCounts(weeks) {
  const rows = [];
  (Array.isArray(weeks) ? weeks : []).forEach((week) => {
    const count = Number(week?.ml_setup_count || 0);
    if (count <= 0) return;
    const oc = Number(week?.oc_return);
    let side = 'flat';
    if (Number.isFinite(oc) && oc > 0) side = 'green';
    else if (Number.isFinite(oc) && oc < 0) side = 'red';
    rows.push({
      week_start: week.week_start,
      week_end: week.week_end,
      oc_return: week.oc_return,
      ml_setup_count: count,
      side,
      range_label: fineBinLabel(oc),
      setups: Array.isArray(week.ml_setups) ? week.ml_setups : [],
    });
  });
  rows.sort((a, b) => String(b.week_start || '').localeCompare(String(a.week_start || '')));
  return rows;
}

export function isoDateFromLocal(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function setupWeekForDate(weeksWithCounts, dateIso) {
  const day = String(dateIso || '').slice(0, 10);
  if (!day) return null;
  return (Array.isArray(weeksWithCounts) ? weeksWithCounts : []).find((week) => (
    String(week?.week_start || '') <= day && String(week?.week_end || '') >= day
  )) || null;
}

export function isDateInSetupWeek(weeksWithCounts, dateIso) {
  return Boolean(setupWeekForDate(weeksWithCounts, dateIso));
}

export function setupWeekSelectLabel(week) {
  if (!week) return '';
  const count = Number(week.ml_setup_count || 0);
  const noun = count === 1 ? 'setup' : 'setups';
  return `${week.week_start} → ${week.week_end} · ${count} ${noun} · ${formatOcPct(week.oc_return)}`;
}
