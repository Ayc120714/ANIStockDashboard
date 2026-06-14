import {parsePctString} from '@core/utils/stockListPayload';

export function extractOutlookRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.sectors)) return payload.sectors;
  if (Array.isArray(payload?.value)) return payload.value;
  return [];
}

export function parsePercentLike(value) {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = String(value);
  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

export function fmtPct(value) {
  const n = Number(value);
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

export function fmtPctOpt(n) {
  return n == null || !Number.isFinite(n) ? '—' : fmtPct(n);
}

export function fmtPerf(value) {
  if (value == null || typeof value === 'object') return '—';
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^\d.eE+-]/g, ''));
  if (!Number.isFinite(n)) return '—';
  return fmtPct(n);
}

export function formatIndexValue(value) {
  if (value == null || value === '') return '—';
  const num = typeof value === 'number' ? value : parseFloat(value);
  if (!Number.isFinite(num)) return String(value);
  return num.toLocaleString('en-IN', {maximumFractionDigits: 2, minimumFractionDigits: 0});
}

export function deriveSectorTrend(day) {
  if (day == null || !Number.isFinite(day)) {
    return {trend: '→', trendDirection: 'sideways'};
  }
  if (day > 0.05) return {trend: '↗', trendDirection: 'up'};
  if (day < -0.05) return {trend: '↘', trendDirection: 'down'};
  return {trend: '→', trendDirection: 'sideways'};
}

export function deriveMarketTrend(item) {
  const chg =
    item?.perf_1d ??
    item?.percentage_change ??
    item?.percentageChange ??
    item?.change_pct ??
    item?.changePercent;
  const num = parsePercentLike(chg);
  if (num == null) return {label: 'SIDEWAYS', direction: 'sideways'};
  if (Math.abs(num) <= 0.05) return {label: 'SIDEWAYS', direction: 'sideways'};
  if (num > 0.05) return {label: 'UP TREND', direction: 'up'};
  return {label: 'DOWN TREND', direction: 'down'};
}

export function normalizeSectorOutlookRow(row, index = 0) {
  if (!row || typeof row !== 'object') return null;
  const name = String(row?.name || row?.sector || row?.title || '').trim();
  if (!name) return null;

  const day =
    parsePercentLike(row?.day1d) ??
    parsePercentLike(row?.avg_day_change) ??
    parsePercentLike(row?.day_change) ??
    parsePercentLike(row?.change_1d) ??
    parsePercentLike(row?.perf_1d);
  const week = parsePercentLike(row?.week1w) ?? parsePercentLike(row?.change_1w) ?? parsePercentLike(row?.perf_1w);
  const month = parsePercentLike(row?.month1m) ?? parsePercentLike(row?.change_1m) ?? parsePercentLike(row?.perf_1m);
  const month3 = parsePercentLike(row?.month3m) ?? parsePercentLike(row?.change_3m) ?? parsePercentLike(row?.perf_3m);
  const month6 = parsePercentLike(row?.month6m) ?? parsePercentLike(row?.change_6m) ?? parsePercentLike(row?.perf_6m);
  const year = parsePercentLike(row?.year1y) ?? parsePercentLike(row?.change_1y) ?? parsePercentLike(row?.perf_1y);
  const year3 = parsePercentLike(row?.year3y) ?? parsePercentLike(row?.change_3y) ?? parsePercentLike(row?.perf_3y);
  const {trend, trendDirection} = deriveSectorTrend(day);

  return {
    id: row?.id ?? index + 1,
    name,
    sector: name,
    trend: typeof row?.trend === 'string' && row.trend.trim() ? row.trend.trim() : trend,
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
    day1dNum: day,
    week1wNum: week,
    month1mNum: month,
    avg_day_change: day != null && Number.isFinite(day) ? day : 0,
  };
}

export function normalizeSectorOutlookPayload(payload) {
  return extractOutlookRows(payload).map(normalizeSectorOutlookRow).filter(Boolean);
}

export function normalizeMarketIndexTableRow(item, idx = 0) {
  if (!item || typeof item !== 'object') return null;
  const name = item.name ?? item.title ?? item.index ?? item.label ?? '';
  if (!name) return null;
  const trend = deriveMarketTrend(item);
  const dayNum = parsePercentLike(item?.perf_1d);
  const weekNum = parsePercentLike(item?.perf_1w ?? item?.week1w ?? item?.['1w']);
  const monthNum = parsePercentLike(item?.perf_1m ?? item?.month1m ?? item?.['1m']);

  return {
    id: item.id ?? idx + 1,
    name,
    symbol: name,
    trend: trend.label,
    trendDirection: trend.direction,
    value: formatIndexValue(item.value ?? item.cmp ?? item.close ?? item.last ?? item.level ?? item.ltp),
    ltp: item.value ?? item.cmp ?? item.close ?? item.last ?? item.level ?? item.ltp,
    percentile: item.percentile ?? item.percentile_value ?? '—',
    day1d: fmtPerf(item.perf_1d),
    week1w: fmtPerf(item.perf_1w ?? item.week1w ?? item?.['1w']),
    month1m: fmtPerf(item.perf_1m ?? item.month1m ?? item?.['1m']),
    month3m: fmtPerf(item.perf_3m ?? item.month3m ?? item?.['3m']),
    month6m: fmtPerf(item.perf_6m ?? item.month6m ?? item?.['6m']),
    year1y: fmtPerf(item.perf_1y ?? item.year1y ?? item?.['1y']),
    year3y: fmtPerf(item.perf_3y ?? item.year3y ?? item?.['3y']),
    day1dNum: dayNum,
    week1wNum: weekNum,
    month1mNum: monthNum,
    change_pct: dayNum,
    pct_change: dayNum,
  };
}

export function normalizeMarketIndicesTablePayload(payload) {
  return extractOutlookRows(payload).map(normalizeMarketIndexTableRow).filter(Boolean);
}

export function formatSubsectorAll(value) {
  if (value == null || value === '') return '—';
  if (typeof value === 'string' && String(value).includes('%')) return String(value);
  const n = typeof value === 'number' ? value : parsePercentLike(value);
  if (n == null || !Number.isFinite(n)) return '—';
  return fmtPct(n);
}

export function normalizeSubsectorRow(sub, sector, weekLabels = []) {
  if (!sub || typeof sub !== 'object') return null;
  const name = String(sub?.name || sub?.subsector || '').trim();
  if (!name) return null;

  const w0 = weekLabels[0];
  const w1 = weekLabels[1];
  const allNum = typeof sub.all === 'number' && Number.isFinite(sub.all) ? sub.all : parsePercentLike(sub.all);
  const trendPct =
    typeof sub.trend_pct === 'number' && Number.isFinite(sub.trend_pct)
      ? sub.trend_pct
      : parsePercentLike(sub.trend_pct);

  return {
    name,
    subsector: name,
    sector: String(sector || sub?.sector || '').trim(),
    performance: formatSubsectorAll(sub.all),
    allNum,
    trend_pct: trendPct,
    week0: w0 != null && sub[w0] != null && sub[w0] !== '' ? `${sub[w0]}%` : '—',
    week1: w1 != null && sub[w1] != null && sub[w1] !== '' ? `${sub[w1]}%` : '—',
    week0Num: w0 != null ? Number(sub[w0]) : null,
    week1Num: w1 != null ? Number(sub[w1]) : null,
    stock_count: sub.stock_count,
  };
}

/** Flatten grouped subsector outlook (`/subsector-outlook/grouped`) for mobile tables. */
export function flattenSubsectorOutlookPayload(payload) {
  const weekLabels = Array.isArray(payload?.weekLabels) ? payload.weekLabels : [];
  const sectors = Array.isArray(payload?.data) ? payload.data : extractOutlookRows(payload);
  const out = [];

  for (const sec of sectors) {
    const sectorName = String(sec?.sector || sec?.name || '').trim();
    const subs = Array.isArray(sec?.subsectors) ? sec.subsectors : [];
    if (subs.length) {
      for (const sub of subs) {
        const row = normalizeSubsectorRow(sub, sectorName, weekLabels);
        if (row) out.push(row);
      }
      continue;
    }
    const row = normalizeSubsectorRow(sec, sectorName, weekLabels);
    if (row) out.push(row);
  }

  return out;
}

export function normSubsectorLabel(s) {
  return String(s || '')
    .normalize('NFKC')
    .replace(/\u00A0/g, ' ')
    .replace(/\u2013/g, '-')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function deriveSubsectorPerformers(
  grouped,
  {search = '', subStrength = 'all', mappedGroups = null} = {},
) {
  const weekLabels = Array.isArray(grouped?.weekLabels) ? grouped.weekLabels : [];
  const mappedSet = mappedGroups?.length ? new Set(mappedGroups.map(normSubsectorLabel)) : null;
  const flat = [];

  for (const sec of grouped?.data || []) {
    const sectorName = String(sec?.sector || '').trim();
    for (const sub of sec?.subsectors || []) {
      const tp = sub.trend_pct;
      if (subStrength === 'strong' && !(tp != null && tp >= 2)) continue;
      if (subStrength === 'weak' && !(tp != null && tp <= -2)) continue;
      if (subStrength === 'mod' && (tp == null || tp > 2 || tp < -2)) continue;
      const name = String(sub?.name || sub?.subsector || '').trim();
      if (!name) continue;
      if (mappedSet && !mappedSet.has(normSubsectorLabel(name))) continue;
      if (search.trim() && !name.toLowerCase().includes(search.trim().toLowerCase())) continue;

      const allNum =
        typeof sub.all === 'number' && Number.isFinite(sub.all) ? sub.all : parsePercentLike(sub.all) ?? 0;
      const weekValues = weekLabels.map(lbl => sub[lbl]).filter(v => typeof v === 'number' && Number.isFinite(v));
      const avgWeek =
        weekValues.length > 0 ? weekValues.reduce((sum, v) => sum + v, 0) / weekValues.length : 0;
      const sortVal = allNum || avgWeek;

      flat.push({sector: sectorName, sub, weekLabels, sortVal, name});
    }
  }

  const sorted = [...flat].sort((a, b) => b.sortVal - a.sortVal);
  const topPerformers = sorted.slice(0, 5).map(({name, sortVal}) => ({
    subsector: name,
    performance: formatSubsectorAll(sortVal),
  }));
  const underPerformers = sorted
    .slice(-5)
    .reverse()
    .map(({name, sortVal}) => ({
      subsector: name,
      performance: formatSubsectorAll(sortVal),
    }));

  return {weekLabels, topPerformers, underPerformers, rows: flat};
}

export function subsectorRowBg(trendPct) {
  if (trendPct == null || !Number.isFinite(trendPct)) return '#fff';
  if (trendPct >= 2) return '#f0fdf4';
  if (trendPct <= -2) return '#fff1f2';
  return '#fefce8';
}

export function pctColor(value, {positive = '#15803d', negative = '#b91c1c', neutral = undefined} = {}) {
  const n = parsePercentLike(value) ?? parsePctString(value);
  if (n == null) return neutral;
  return n >= 0 ? positive : negative;
}

export function trendTagStyle(direction) {
  if (direction === 'up') return {backgroundColor: '#15803d', label: 'UP TREND'};
  if (direction === 'down') return {backgroundColor: '#ef4444', label: 'DOWN TREND'};
  return {backgroundColor: '#64748b', label: 'SIDEWAYS'};
}
