import { apiGet } from './apiClient';

const SECTOR_OUTLOOK_ENDPOINT = '/sector-outlook';

const extractRows = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.sectors)) return payload.sectors;
  return [];
};

const toNum = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const parsePercentLike = (value) => {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = String(value);
  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
};

const fmtPct = (value) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

const normalizeRow = (row, index) => {
  if (!row || typeof row !== 'object') return null;
  const name = String(row?.name || row?.sector || row?.title || '').trim();
  if (!name) return null;

  const day = toNum(
    parsePercentLike(row?.day1d)
    ?? row?.avg_day_change
    ?? row?.day_change
    ?? row?.change_1d
    ?? row?.perf_1d
  );
  const week = toNum(parsePercentLike(row?.week1w) ?? row?.change_1w ?? row?.perf_1w);
  const month = toNum(parsePercentLike(row?.month1m) ?? row?.change_1m ?? row?.perf_1m);
  const month3 = toNum(parsePercentLike(row?.month3m) ?? row?.change_3m ?? row?.perf_3m);
  const month6 = toNum(parsePercentLike(row?.month6m) ?? row?.change_6m ?? row?.perf_6m);
  const year = toNum(parsePercentLike(row?.year1y) ?? row?.change_1y ?? row?.perf_1y);
  const year3 = toNum(parsePercentLike(row?.year3y) ?? row?.change_3y ?? row?.perf_3y);
  const trend = day >= 0 ? '↗' : '↘';

  return {
    id: row?.id ?? index + 1,
    name,
    sector: name,
    trend,
    value: row?.value ?? row?.cmp ?? row?.close ?? row?.last ?? '—',
    percentile: row?.percentile ?? row?.percentile_value ?? row?.percentileValue ?? '—',
    day1d: typeof row?.day1d === 'string' ? row.day1d : fmtPct(day),
    week1w: typeof row?.week1w === 'string' ? row.week1w : fmtPct(week),
    month1m: typeof row?.month1m === 'string' ? row.month1m : fmtPct(month),
    month3m: typeof row?.month3m === 'string' ? row.month3m : fmtPct(month3),
    month6m: typeof row?.month6m === 'string' ? row.month6m : fmtPct(month6),
    year1y: typeof row?.year1y === 'string' ? row.year1y : fmtPct(year),
    year3y: typeof row?.year3y === 'string' ? row.year3y : fmtPct(year3),
    avg_day_change: day,
    stock_count: Number.isFinite(Number(row?.stock_count ?? row?.stocks ?? row?.count))
      ? Number(row?.stock_count ?? row?.stocks ?? row?.count)
      : null,
  };
};

export const fetchSectorOutlook = async () => {
  const data = await apiGet(SECTOR_OUTLOOK_ENDPOINT);
  return extractRows(data).map(normalizeRow).filter(Boolean);
};
