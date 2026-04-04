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

/** Format % for table cells; missing data → em dash (never fake +0.00%). */
const fmtPctOpt = (n) => (n == null || !Number.isFinite(n) ? '—' : fmtPct(n));

const normalizeRow = (row, index) => {
  if (!row || typeof row !== 'object') return null;
  const name = String(row?.name || row?.sector || row?.title || '').trim();
  if (!name) return null;

  const day =
    parsePercentLike(row?.day1d)
    ?? parsePercentLike(row?.avg_day_change)
    ?? parsePercentLike(row?.day_change)
    ?? parsePercentLike(row?.change_1d)
    ?? parsePercentLike(row?.perf_1d);
  const week = parsePercentLike(row?.week1w) ?? parsePercentLike(row?.change_1w) ?? parsePercentLike(row?.perf_1w);
  const month = parsePercentLike(row?.month1m) ?? parsePercentLike(row?.change_1m) ?? parsePercentLike(row?.perf_1m);
  const month3 = parsePercentLike(row?.month3m) ?? parsePercentLike(row?.change_3m) ?? parsePercentLike(row?.perf_3m);
  const month6 = parsePercentLike(row?.month6m) ?? parsePercentLike(row?.change_6m) ?? parsePercentLike(row?.perf_6m);
  const year = parsePercentLike(row?.year1y) ?? parsePercentLike(row?.change_1y) ?? parsePercentLike(row?.perf_1y);
  const year3 = parsePercentLike(row?.year3y) ?? parsePercentLike(row?.change_3y) ?? parsePercentLike(row?.perf_3y);

  let trendDirection = 'sideways';
  if (day != null && Number.isFinite(day)) {
    if (day > 0.05) trendDirection = 'up';
    else if (day < -0.05) trendDirection = 'down';
  }
  const trend =
    day == null || !Number.isFinite(day) ? '→' : day > 0.05 ? '↗' : day < -0.05 ? '↘' : '→';

  return {
    id: row?.id ?? index + 1,
    name,
    sector: name,
    trend,
    trendDirection,
    value: row?.value ?? row?.cmp ?? row?.close ?? row?.last ?? '—',
    percentile: row?.percentile ?? row?.percentile_value ?? row?.percentileValue ?? '—',
    day1d: typeof row?.day1d === 'string' ? row.day1d : fmtPctOpt(day),
    week1w: typeof row?.week1w === 'string' ? row.week1w : fmtPctOpt(week),
    month1m: typeof row?.month1m === 'string' ? row.month1m : fmtPctOpt(month),
    month3m: typeof row?.month3m === 'string' ? row.month3m : fmtPctOpt(month3),
    month6m: typeof row?.month6m === 'string' ? row.month6m : fmtPctOpt(month6),
    year1y: typeof row?.year1y === 'string' ? row.year1y : fmtPctOpt(year),
    year3y: typeof row?.year3y === 'string' ? row.year3y : fmtPctOpt(year3),
    avg_day_change: day != null && Number.isFinite(day) ? day : 0,
    stock_count: Number.isFinite(Number(row?.stock_count ?? row?.stocks ?? row?.count))
      ? Number(row?.stock_count ?? row?.stocks ?? row?.count)
      : null,
  };
};

export const fetchSectorOutlook = async () => {
  const data = await apiGet(SECTOR_OUTLOOK_ENDPOINT);
  return extractRows(data).map(normalizeRow).filter(Boolean);
};
