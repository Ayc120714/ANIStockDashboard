const MIN_FII_DII_DAYS = 20;

const parseIsoLikeDate = value => {
  if (!value) return Number.NEGATIVE_INFINITY;
  const normalized = String(value).trim().replace(/\//g, '-');
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
};

export function normalizeRecentDaily(daily, limit = MIN_FII_DII_DAYS) {
  if (!Array.isArray(daily)) return [];
  const sorted = [...daily].sort((a, b) => parseIsoLikeDate(b?.date) - parseIsoLikeDate(a?.date));
  return sorted.slice(0, limit);
}

export function fmtCr(val) {
  if (val == null || Number.isNaN(Number(val))) return '—';
  const n = Number(val);
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  return `${n < 0 ? '-' : '+'}₹${formatted} Cr`;
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
    bars: [],
    series: [],
    shownPoint: {net: null, date: ''},
  };
  if (!fiiDiiData) return empty;

  const daily = normalizeRecentDaily(fiiDiiData.daily, MIN_FII_DII_DAYS);
  const latest = daily[0];
  const mtdNet = Number(fiiDiiData.mtd?.[kind]?.net ?? 0) || 0;
  let series = [...daily].reverse().map(d => ({
    date: formatFiiDiiDate(d?.date ?? ''),
    net: Number(d?.[kind]?.net ?? 0) || 0,
  }));
  let bars = series.map(d => d.net);
  if (bars.length < 1 && Number.isFinite(mtdNet)) {
    series = [{date: 'MTD', net: mtdNet}];
    bars = [mtdNet];
  }
  const latestNet = latest != null ? Number(latest?.[kind]?.net ?? 0) || 0 : null;
  const shownPoint =
    series.length > 0
      ? series[series.length - 1]
      : {net: latestNet ?? mtdNet, date: formatFiiDiiDate(latest?.date ?? '')};

  return {
    latestNet: latestNet ?? mtdNet,
    latestDate: formatFiiDiiDate(latest?.date ?? ''),
    mtdNet,
    bars,
    series,
    shownPoint,
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

export {MIN_FII_DII_DAYS};
