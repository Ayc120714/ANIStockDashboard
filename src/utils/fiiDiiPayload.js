import { parseIsoLikeDate } from './marketOutlookLoader';

export const FII_DII_FETCH_DAYS = 45;

export const FII_DII_POSITIVE_COLOR = '#28a745';
export const FII_DII_NEGATIVE_COLOR = '#dc3545';
export const FII_DII_NEUTRAL_COLOR = '#9aa0a6';

export function filterDailyForLatestCalendarMonth(daily, parseDate = parseIsoLikeDate) {
  if (!Array.isArray(daily) || daily.length === 0) return [];

  const withTs = daily
    .map((row) => ({ row, ts: parseDate(row?.date) }))
    .filter(({ ts }) => Number.isFinite(ts) && ts !== Number.NEGATIVE_INFINITY);

  if (!withTs.length) return [];

  const latestTs = Math.max(...withTs.map(({ ts }) => ts));
  const rollingMonthStart = latestTs - (30 * 24 * 60 * 60 * 1000);

  return withTs
    .filter(({ ts }) => ts >= rollingMonthStart && ts <= latestTs)
    .sort((a, b) => a.ts - b.ts)
    .map(({ row }) => row);
}

export function fmtCr(val) {
  if (val == null || Number.isNaN(Number(val))) return '—';
  const n = Number(val);
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n < 0 ? '-' : '+'}₹${formatted} Cr`;
}

export function formatAccessibleCr(val) {
  if (val == null || !Number.isFinite(Number(val))) return '';
  const n = Number(val);
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  if (n < 0) return `-₹${formatted} Cr`;
  return `₹${formatted} Cr`;
}

export function formatCompactCr(val) {
  if (val == null || !Number.isFinite(Number(val))) return '—';
  const n = Number(val);
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);

  if (abs >= 1000) {
    const scaled = abs / 1000;
    const text = scaled >= 100
      ? Math.round(scaled).toString()
      : scaled.toFixed(1).replace(/\.0$/, '');
    return `${sign}₹${text}K Cr`;
  }

  if (abs >= 100) {
    return `${sign}₹${Math.round(abs)} Cr`;
  }

  const formatted = abs.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
  return `${sign}₹${formatted} Cr`;
}

export function getNetSignKind(net, hasData) {
  if (!hasData) return 'none';
  const n = Number(net);
  if (!Number.isFinite(n) || n === 0) return 'none';
  return n > 0 ? 'buy' : 'sell';
}

export function getFiiDiiColor(net, hasData) {
  const kind = getNetSignKind(net, hasData);
  if (kind === 'buy') return FII_DII_POSITIVE_COLOR;
  if (kind === 'sell') return FII_DII_NEGATIVE_COLOR;
  return FII_DII_NEUTRAL_COLOR;
}

export function buildPeriodCircle({ net, hasData, periodLabel, year }) {
  const display = hasData ? formatCompactCr(net) : '—';
  const color = getFiiDiiColor(net, hasData);
  const signKind = getNetSignKind(net, hasData);
  const direction = signKind === 'buy' ? 'Buy' : signKind === 'sell' ? 'Sell' : hasData ? 'Neutral' : 'No data';
  const yearSuffix = year != null && String(periodLabel) !== String(year) ? ` ${year}` : '';
  const ariaAmount = hasData ? formatAccessibleCr(Math.abs(Number(net))) : '';
  const ariaLabel = hasData
    ? `${periodLabel}${yearSuffix} ${direction} ${ariaAmount}`.trim()
    : `${periodLabel}${yearSuffix} No data`;

  return {
    label: periodLabel,
    net,
    hasData,
    display,
    color,
    ariaLabel,
    signKind,
    year,
  };
}

export function periodCircleShownPoint(circle) {
  if (!circle?.hasData || !Number.isFinite(Number(circle.net))) return null;
  const suffix = circle.year != null && String(circle.label) !== String(circle.year)
    ? ` ${circle.year}`
    : '';
  return { net: Number(circle.net), date: `${circle.label}${suffix}` };
}

export function mapQuarterCircles(quarterly, effectiveYear, kind) {
  const year = Number(effectiveYear) || new Date().getFullYear();
  const byQuarter = new Map();

  if (Array.isArray(quarterly)) {
    quarterly.forEach((item) => {
      const q = Number(item?.quarter);
      if (Number(item?.year) === year && q >= 1 && q <= 4) {
        byQuarter.set(q, item);
      }
    });
  }

  return [1, 2, 3, 4].map((quarter) => {
    const item = byQuarter.get(quarter);
    const hasData = Boolean(item?.has_data);
    const net = hasData ? Number(item?.[kind]?.net ?? 0) : null;
    return buildPeriodCircle({
      net,
      hasData,
      periodLabel: `Q${quarter}`,
      year,
    });
  });
}

export function mapYearCircles(yearly, effectiveYear, kind) {
  const anchor = Number(effectiveYear) || new Date().getFullYear();
  const byYear = new Map();

  if (Array.isArray(yearly)) {
    yearly.forEach((item) => {
      if (item?.year != null) byYear.set(Number(item.year), item);
    });
  }

  return [0, 1, 2].map((offset) => {
    const year = anchor - offset;
    const item = byYear.get(year);
    const hasData = Boolean(item?.has_data);
    const net = hasData ? Number(item?.[kind]?.net ?? 0) : null;
    return buildPeriodCircle({
      net,
      hasData,
      periodLabel: String(year),
      year,
    });
  });
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
    quarters: [],
    years: [],
  };

  if (!fiiDiiData) return empty;

  const monthDaily = filterDailyForLatestCalendarMonth(fiiDiiData.daily);
  const latest = monthDaily.length ? monthDaily[monthDaily.length - 1] : null;
  const mtdNet = Number(fiiDiiData.mtd?.[kind]?.net ?? 0) || 0;

  let series = monthDaily.map((d) => ({
    date: d?.date ?? '',
    net: Number(d?.[kind]?.net ?? 0) || 0,
  }));
  let bars = series.map((d) => d.net);

  if (bars.length < 1 && Number.isFinite(mtdNet)) {
    series = [{ date: 'MTD', net: mtdNet }];
    bars = [mtdNet];
  }

  const effectiveYear = fiiDiiData.effective_year ?? fiiDiiData.effectiveYear;
  const quarters = mapQuarterCircles(fiiDiiData.quarterly, effectiveYear, kind);
  const years = mapYearCircles(fiiDiiData.yearly, effectiveYear, kind);
  const effectiveMonth = Number(fiiDiiData.effective_month ?? fiiDiiData.effectiveMonth);
  const currentQuarter = Number.isFinite(effectiveMonth) && effectiveMonth >= 1 && effectiveMonth <= 12
    ? Math.ceil(effectiveMonth / 3)
    : null;
  const qtdCircle = currentQuarter == null ? null : quarters[currentQuarter - 1];
  const ytdCircle = years[0];
  const latestNet = latest != null ? Number(latest?.[kind]?.net ?? 0) || 0 : null;

  return {
    latestNet: latestNet ?? mtdNet,
    latestDate: latest?.date ?? '',
    mtdNet,
    qtdNet: qtdCircle?.hasData ? qtdCircle.net : null,
    ytdNet: ytdCircle?.hasData ? ytdCircle.net : null,
    bars,
    series,
    quarters,
    years,
  };
}
