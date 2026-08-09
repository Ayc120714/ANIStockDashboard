const MIN_FII_DII_DAYS = 45;
const NEUTRAL_PERIOD_COLOR = '#9ca3af';

const parseIsoLikeDate = value => {
  if (!value) return Number.NEGATIVE_INFINITY;
  const normalized = String(value).trim().replace(/\//g, '-');
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
};

export function parseFiiDiiDateParts(value) {
  const ms = parseIsoLikeDate(value);
  if (!Number.isFinite(ms) || ms === Number.NEGATIVE_INFINITY) return null;
  const d = new Date(ms);
  return {ms, year: d.getFullYear(), month: d.getMonth()};
}

export function normalizeRecentDaily(daily, limit = MIN_FII_DII_DAYS) {
  if (!Array.isArray(daily)) return [];
  const sorted = [...daily].sort((a, b) => parseIsoLikeDate(b?.date) - parseIsoLikeDate(a?.date));
  return sorted.slice(0, limit);
}

/** Keep the rolling 30-day window ending at the newest parsed daily date. */
export function filterRollingCalendarMonth(daily) {
  if (!Array.isArray(daily) || daily.length === 0) return [];
  const sorted = [...daily].sort((a, b) => parseIsoLikeDate(b?.date) - parseIsoLikeDate(a?.date));
  const anchor = parseFiiDiiDateParts(sorted[0]?.date);
  if (!anchor) return [];
  const rollingMonthStart = anchor.ms - 30 * 24 * 60 * 60 * 1000;
  return sorted.filter(row => {
    const parts = parseFiiDiiDateParts(row?.date);
    return parts && parts.ms >= rollingMonthStart && parts.ms <= anchor.ms;
  });
}

export function fmtCr(val) {
  if (val == null || Number.isNaN(Number(val))) return '—';
  const n = Number(val);
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  return `${n < 0 ? '-' : '+'}₹${formatted} Cr`;
}

/** Compact crore label for small period circles (e.g. +₹12.4K Cr). */
export function fmtCompactCr(val) {
  if (val == null || Number.isNaN(Number(val))) return '—';
  const n = Number(val);
  const sign = n < 0 ? '-' : '+';
  const abs = Math.abs(n);
  if (abs >= 1000) {
    return `${sign}₹${(abs / 1000).toFixed(1)}K Cr`;
  }
  if (abs >= 100) {
    return `${sign}₹${Math.round(abs)} Cr`;
  }
  const formatted = abs.toLocaleString('en-IN', {minimumFractionDigits: 1, maximumFractionDigits: 1});
  return `${sign}₹${formatted} Cr`;
}

export function fmtCrAccessibility(val) {
  if (val == null || Number.isNaN(Number(val))) return '';
  const n = Number(val);
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  return `${n < 0 ? '-' : ''}₹${formatted} Cr`;
}

export function periodFlowLabel(net, hasData) {
  if (!hasData || net == null || Number.isNaN(Number(net))) return 'No data';
  const n = Number(net);
  if (n > 0) return 'Buy';
  if (n < 0) return 'Sell';
  return 'Neutral';
}

export function periodCircleTone(net, hasData) {
  if (!hasData || net == null || Number.isNaN(Number(net))) return 'neutral';
  const n = Number(net);
  if (n > 0) return 'positive';
  if (n < 0) return 'negative';
  return 'neutral';
}

export function buildPeriodAccessibilityLabel(period, net, hasData, year) {
  const flow = periodFlowLabel(net, hasData);
  const parts = [period];
  if (year != null && String(period) !== String(year)) parts.push(String(year));
  parts.push(flow);
  if (hasData && net != null && !Number.isNaN(Number(net))) {
    parts.push(fmtCrAccessibility(net));
  }
  return parts.join(' ');
}

export function periodCircleShownPoint(circle) {
  if (!circle?.hasData || !Number.isFinite(Number(circle.net))) return null;
  const suffix = circle.year != null && String(circle.label) !== String(circle.year)
    ? ` ${circle.year}`
    : '';
  return {net: Number(circle.net), date: `${circle.label}${suffix}`};
}

export function mapQuarterCircles(quarterly, kind) {
  const slots = [1, 2, 3, 4].map(quarter => ({
    label: `Q${quarter}`,
    quarter,
    year: null,
    net: null,
    hasData: false,
  }));
  if (!Array.isArray(quarterly) || quarterly.length === 0) return slots;

  const byQuarter = new Map();
  for (const item of quarterly) {
    const q = Number(item?.quarter);
    if (q >= 1 && q <= 4) byQuarter.set(q, item);
  }

  return slots.map(slot => {
    const item = byQuarter.get(slot.quarter);
    if (!item) return slot;
    const hasData = item.has_data !== false && item[kind]?.net != null;
    return {
      label: item.label || `Q${slot.quarter}`,
      quarter: slot.quarter,
      year: item.year ?? null,
      net: hasData ? Number(item[kind].net) : null,
      hasData,
    };
  });
}

export function mapYearCircles(yearly, kind) {
  if (!Array.isArray(yearly)) return [];
  return yearly.map(item => {
    const hasData = item?.has_data !== false && item?.[kind]?.net != null;
    return {
      label: item?.label || (item?.year != null ? String(item.year) : '—'),
      year: item?.year ?? null,
      net: hasData ? Number(item[kind].net) : null,
      hasData,
    };
  });
}

export function formatFiiDiiDate(value) {
  if (!value) return '';
  const ms = parseIsoLikeDate(value);
  if (!Number.isFinite(ms) || ms === Number.NEGATIVE_INFINITY) return String(value);
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
      .format(new Date(ms))
      .replace(/ /g, '-');
  } catch (_) {
    return String(value);
  }
}

export function buildFiiDiiCard(fiiDiiData, kind) {
  const empty = {
    latestNet: null,
    latestDate: '',
    mtdNet: null,
    qtdNet: null,
    ytdNet: null,
    bars: [],
    series: [],
    shownPoint: {net: null, date: ''},
    quarters: mapQuarterCircles(null, kind),
    years: mapYearCircles(null, kind),
  };
  if (!fiiDiiData) return empty;

  const allDaily = normalizeRecentDaily(fiiDiiData.daily, MIN_FII_DII_DAYS);
  const monthDaily = filterRollingCalendarMonth(fiiDiiData.daily);
  const latest = allDaily[0] ?? monthDaily[0];
  const mtdNet = Number(fiiDiiData.mtd?.[kind]?.net ?? 0) || 0;
  let series = [...monthDaily].reverse().map(d => ({
    date: formatFiiDiiDate(d?.date ?? ''),
    net: Number(d?.[kind]?.net ?? 0) || 0,
  }));
  let bars = series.map(d => d.net);
  if (bars.length < 1 && Number.isFinite(mtdNet)) {
    series = [{date: 'MTD', net: mtdNet}];
    bars = [mtdNet];
  }
  const latestNet = latest != null ? Number(latest?.[kind]?.net ?? 0) || 0 : null;
  const quarters = mapQuarterCircles(fiiDiiData.quarterly, kind);
  const years = mapYearCircles(fiiDiiData.yearly, kind);
  const effectiveMonth = Number(fiiDiiData.effective_month ?? fiiDiiData.effectiveMonth);
  const currentQuarter =
    Number.isFinite(effectiveMonth) && effectiveMonth >= 1 && effectiveMonth <= 12
      ? Math.ceil(effectiveMonth / 3)
      : null;
  const qtdCircle = currentQuarter == null ? null : quarters[currentQuarter - 1];
  const ytdCircle = years[0];
  const shownPoint =
    series.length > 0
      ? series[series.length - 1]
      : {net: latestNet ?? mtdNet, date: formatFiiDiiDate(latest?.date ?? '')};

  return {
    latestNet: latestNet ?? mtdNet,
    latestDate: formatFiiDiiDate(latest?.date ?? ''),
    mtdNet,
    qtdNet: qtdCircle?.hasData ? qtdCircle.net : null,
    ytdNet: ytdCircle?.hasData ? ytdCircle.net : null,
    bars,
    series,
    shownPoint,
    quarters,
    years,
  };
}

/** Normalize Screener /fii/ sector ranking payload for Markets UI. */
export function normalizeFiiSectorFlowsPayload(payload) {
  const sectors = Array.isArray(payload?.sectors) ? payload.sectors : [];
  return {
    ok: payload?.ok !== false,
    asOf: payload?.as_of || payload?.asOf || null,
    sort: payload?.sort || 'fortnight_change',
    source: payload?.source || 'screener.in/fii',
    cadence: payload?.cadence || 'fortnightly',
    label: payload?.label || 'FII sector additions (fortnightly)',
    authRequired: Boolean(payload?.auth_required || payload?.authRequired),
    message: payload?.message || null,
    sectors: sectors
      .map(row => ({
        sector: String(row?.sector || '').trim(),
        aum: row?.aum == null ? null : Number(row.aum),
        fortnightChange: row?.fortnight_change ?? row?.fortnightChange ?? null,
        flow1y: row?.flow_1y ?? row?.flow1y ?? null,
        fiiOwnershipPct: row?.fii_ownership_pct ?? row?.fiiOwnershipPct ?? null,
      }))
      .filter(r => r.sector),
    count: Number(payload?.count ?? sectors.length) || 0,
  };
}

export function sortFiiSectorRows(rows, sortKey = 'fortnightChange') {
  const list = Array.isArray(rows) ? [...rows] : [];
  const key =
    sortKey === 'flow_1y' || sortKey === 'flow1y' || sortKey === '1y'
      ? 'flow1y'
      : sortKey === 'aum'
        ? 'aum'
        : 'fortnightChange';
  list.sort((a, b) => {
    const av = a?.[key];
    const bv = b?.[key];
    if (av == null && bv == null) return String(a?.sector || '').localeCompare(String(b?.sector || ''));
    if (av == null) return 1;
    if (bv == null) return -1;
    if (Number(bv) !== Number(av)) return Number(bv) - Number(av);
    return String(a?.sector || '').localeCompare(String(b?.sector || ''));
  });
  return list;
}

const FII_STOCK_SORT_KEYS = {
  symbol: 'symbol',
  price: 'price',
  cmp: 'price',
  day1d: 'day1d',
  chg: 'day1d',
  fiiPct: 'fiiPct',
  fii_pct: 'fiiPct',
  fiiPctDelta: 'fiiPctDelta',
  fii_pct_delta: 'fiiPctDelta',
};

/** Sort stocks under a clicked FII sector (Symbol / CMP / CHG% / FII % / FII Δ). */
export function sortFiiSectorStockRows(rows, sortKey = 'day1d', direction = 'desc') {
  const list = Array.isArray(rows) ? [...rows] : [];
  const key = FII_STOCK_SORT_KEYS[sortKey] || 'day1d';
  const dir = direction === 'asc' ? 1 : -1;
  list.sort((a, b) => {
    if (key === 'symbol') {
      return dir * String(a?.symbol || '').localeCompare(String(b?.symbol || ''));
    }
    const av = a?.[key];
    const bv = b?.[key];
    if (av == null && bv == null) {
      return String(a?.symbol || '').localeCompare(String(b?.symbol || ''));
    }
    if (av == null) return 1;
    if (bv == null) return -1;
    if (Number(av) !== Number(bv)) return dir * (Number(av) - Number(bv));
    return String(a?.symbol || '').localeCompare(String(b?.symbol || ''));
  });
  return list;
}

export function nextFiiSectorStockSort(prev, column) {
  const key = FII_STOCK_SORT_KEYS[column] || column;
  if (prev?.key === key) {
    return {key, direction: prev.direction === 'asc' ? 'desc' : 'asc'};
  }
  return {key, direction: key === 'symbol' ? 'asc' : 'desc'};
}

export function normalizeFiiSectorStocksPayload(payload) {
  const stocks = Array.isArray(payload?.stocks) ? payload.stocks : [];
  return {
    ok: payload?.ok !== false,
    sector: String(payload?.sector || '').trim(),
    matchedSectors: Array.isArray(payload?.matched_sectors || payload?.matchedSectors)
      ? payload.matched_sectors || payload.matchedSectors
      : [],
    stocks: stocks
      .map(row => ({
        symbol: String(row?.symbol || '')
          .trim()
          .toUpperCase(),
        sector: row?.sector || '',
        subsector: row?.subsector || '',
        price: row?.price == null ? null : Number(row.price),
        day1d: row?.day1d ?? row?.chg_pct ?? null,
        fiiPct: row?.fii_pct ?? row?.fiiPct ?? null,
        fiiPctDelta: row?.fii_pct_delta ?? row?.fiiPctDelta ?? null,
        fiiPeriod: row?.fii_period ?? row?.fiiPeriod ?? null,
      }))
      .filter(r => r.symbol),
    count: Number(payload?.count ?? stocks.length) || 0,
  };
}

export function buildBarMetrics(values, height = 68) {
  if (!values?.length) return null;
  const safeVals = values.map(v => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  });
  const maxAbs = Math.max(...safeVals.map(Math.abs), 1);
  const midY = height / 2;
  const maxH = midY - 2;
  return safeVals.map(val => ({
    val,
    height: Math.max((Math.abs(val) / maxAbs) * maxH, 0.5),
    positive: val >= 0,
  }));
}

export {MIN_FII_DII_DAYS, NEUTRAL_PERIOD_COLOR};
