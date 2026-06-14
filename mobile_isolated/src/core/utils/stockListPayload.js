/** Normalize `{ data: Stock[] }` or array responses from `/api/stocks/*` endpoints. */
export function parseStockListResponse(res) {
  if (!res) return [];
  if (Array.isArray(res.data)) return res.data;
  if (Array.isArray(res)) return res;
  if (res && typeof res === 'object' && Array.isArray(res.stocks)) return res.stocks;
  return [];
}

export function stockRowPct(row, period = 'day') {
  const keyOrder =
    period === 'week'
      ? [row?.week1w, row?.week_1w, row?.perf_1w, row?.change_1w, row?.change_pct_1w]
      : period === 'month'
        ? [row?.month1m, row?.month_1m, row?.perf_1m, row?.change_1m, row?.change_pct_1m]
        : [row?.day1d, row?.day_1d, row?.perf_1d, row?.change_1d, row?.change_pct_1d];
  const v = [...keyOrder, row?.change_pct, row?.pct_change, row?.percentage_change].find(x => x != null);
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const parsed = parsePctString(v);
  return parsed;
}

export function formatPct(v) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  const n = Number(v);
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

export function parsePctString(s) {
  if (s == null || s === '—' || s === '') return null;
  const n = parseFloat(String(s).replace(/%/g, ''));
  return Number.isFinite(n) ? n : null;
}
