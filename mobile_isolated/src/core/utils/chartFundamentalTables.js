import {formatINR} from '@core/utils/formatMarket';

function firstVal(row, keys) {
  for (const k of keys) {
    const v = row?.[k];
    if (v != null && v !== '') return v;
  }
  return null;
}

function signalFor(rows, symbol) {
  const key = String(symbol || '').toUpperCase();
  if (!key) return null;
  return rows.find(r => String(r?.symbol || '').toUpperCase() === key) || null;
}

function formatRs(v) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  const n = Number(v);
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

function formatNum(v, digits = 1) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return Number(v).toFixed(digits);
}

function formatRating(row, signal) {
  const raw =
    signal?.recommendation ||
    signal?.rating ||
    row?.recommendation ||
    row?.rating ||
    '';
  const s = String(raw || '').trim();
  if (!s) return '—';
  return s.replace(/_/g, ' ');
}

function formatHorizon(row, signal) {
  const raw = signal?.horizon || row?.horizon || '';
  const s = String(raw || '').trim();
  if (!s) return '—';
  return s.replace(/_/g, ' ');
}

function mapRow(customRow, signals, block) {
  const sym = customRow?.symbol;
  const signal = signalFor(signals, sym);
  const rs = customRow?.[block.rsField];
  return {
    symbol: sym,
    sector: firstVal(customRow, ['sector']) || firstVal(signal, ['sector']) || '—',
    close: firstVal(customRow, block.closeFields) ?? firstVal(signal, ['cmp', 'price', 'close']),
    prevClose: firstVal(customRow, block.prevCloseFields),
    rs,
    rsLabel: formatRs(rs),
    diPlus: firstVal(customRow, ['di_plus', 'diPlus', 'dmi_plus']) ?? firstVal(signal, ['di_plus', 'dmi_plus']),
    rating: formatRating(customRow, signal),
    horizon: formatHorizon(customRow, signal),
  };
}

export const CHART_FUNDAMENTAL_BLOCKS = [
  {
    id: 'daily',
    title: 'Daily setup (RS 123)',
    subtitle: 'RS vs Nifty daily · scanned symbols',
    rsField: 'rs_daily_123',
    closeFields: ['close', 'daily_close', 'cmp'],
    prevCloseFields: [],
    rsHeader: 'RS123',
    closeHeader: 'Close',
    prevHeader: null,
  },
  {
    id: 'weekly',
    title: 'Weekly setup (RS 52W)',
    subtitle: 'Weekly vs Nifty · scanned symbols',
    rsField: 'rs_weekly_52',
    closeFields: ['weekly_close', 'wk_close', 'close'],
    prevCloseFields: ['prev_week_close', 'prev_week_high'],
    rsHeader: 'RS52',
    closeHeader: 'Wk Close',
    prevHeader: 'Prev Wk',
  },
  {
    id: 'monthly',
    title: 'Monthly setup (RS 11M)',
    subtitle: 'Chartink monthly vs Nifty',
    rsField: 'rs_monthly_11',
    closeFields: ['monthly_close', 'mo_close', 'close'],
    prevCloseFields: ['prev_month_close', 'prev_month_high'],
    rsHeader: 'RS11',
    closeHeader: 'Mo Close',
    prevHeader: 'Prev Mo',
  },
];

export function buildChartFundamentalBlocks(customRows = [], signals = []) {
  const scanned = customRows.length;
  return CHART_FUNDAMENTAL_BLOCKS.map(block => {
    const rows = customRows
      .filter(r => {
        const v = r?.[block.rsField];
        return v != null && !Number.isNaN(Number(v));
      })
      .map(r => mapRow(r, signals, block))
      .sort((a, b) => Number(b.rs) - Number(a.rs));
    return {
      ...block,
      rows,
      matchCount: rows.length,
      scanned,
    };
  });
}

export function formatChartCell(row, key) {
  switch (key) {
    case 'close':
    case 'prevClose':
      return row[key] != null ? formatINR(row[key]) : '—';
    case 'rs':
      return row.rsLabel;
    case 'diPlus':
      return formatNum(row.diPlus);
    default:
      return row[key] ?? '—';
  }
}
