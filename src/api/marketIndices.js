import { apiGet } from './apiClient';

const MARKET_INDICES_ENDPOINT = '/market-indices/';
/** Avoid browser/CDN serving a stale JSON snapshot after auth/session changes. */
const FETCH_NO_STORE = { cache: 'no-store' };

const formatValue = (value) => {
  if (value === null || value === undefined) return '';
  const num = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(num)) return '';
  return num.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
};

const formatChange = (change) => {
  if (change === null || change === undefined) return '';
  const num = typeof change === 'number' ? change : parseFloat(change);
  if (isNaN(num)) return '';
  const sign = num >= 0 ? '+' : '';
  return `${sign}${num.toFixed(2)}%`;
};

const formatPercentile = (percentile) => {
  if (percentile === null || percentile === undefined) return '—';
  const num = typeof percentile === 'number' ? percentile : parseFloat(percentile);
  if (isNaN(num)) return '—';
  return `${num.toFixed(2)}%`;
};

const formatPE = (pe) => {
  if (pe === null || pe === undefined) return '—';
  const num = typeof pe === 'number' ? pe : parseFloat(pe);
  if (isNaN(num)) return '—';
  return `${num.toFixed(1)} PE`;
};

const deriveTrend = (item) => {
  const chg =
    item.perf_1d ??
    item.percentage_change ??
    item.percentageChange ??
    item.change_pct ??
    item.changePercent;
  const num = typeof chg === 'number' ? chg : parseFloat(chg);
  if (isNaN(num)) return { label: 'SIDEWAYS', direction: 'sideways' };
  // Trend badge dead zone (does not alter the numeric 1D cell — that uses `perf_1d` only below).
  if (Math.abs(num) <= 0.05) return { label: 'SIDEWAYS', direction: 'sideways' };
  if (num > 0.05) return { label: 'UP TREND', direction: 'up' };
  return { label: 'DOWN TREND', direction: 'down' };
};

const mapCard = (item) => {
  if (!item || typeof item !== 'object') return null;
  const title = item.title ?? item.name ?? item.index ?? item.label;
  if (!title) return null;
  const trend = deriveTrend(item);
  return {
    title,
    trend: trend.label,
    trendDirection: trend.direction,
    value: formatValue(item.value ?? item.cmp ?? item.close ?? item.last ?? item.level),
    change: formatChange(
      item.perf_1d ??
      item.percentage_change ??
      item.percentageChange ??
      item.change_pct ??
      item.changePercent ??
      item.change_percent ??
      item.change ??
      item.chg
    ),
    percentile: formatPercentile(item.percentile ?? item.percentile_value ?? item.percentileValue ?? item.percentile_pct ?? item.percentilePct),
    pe: formatPE(item.pe ?? item.pe_ratio ?? item.peRatio ?? item.peValue),
    perfData: [
      item.perf_3y, item.perf_1y, item.perf_6m,
      item.perf_3m, item.perf_1m, item.perf_1w, item.perf_1d
    ].filter((v) => v != null).map(Number),
    dayOpen: item.day_open,
    dayHigh: item.day_high,
    dayLow: item.day_low,
    dayClose: item.value ?? item.cmp ?? item.close,
  };
};

const normalizeCards = (cards) => (Array.isArray(cards) ? cards.map(mapCard).filter(Boolean) : []);

const extractArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload?.value && Array.isArray(payload.value)) return payload.value;
  if (payload?.data && Array.isArray(payload.data)) return payload.data;
  return [];
};

const normalizeMarketIndicesResponse = (payload) => {
  const source = extractArray(payload);
  let indexCards = [];
  let smallcapCards = [];

  if (source.length) {
    const indexPatterns = ['nifty 50', 'nifty next 50', 'nifty midcap 50', 'nifty bank'];
    const smallcapPatterns = ['nifty 100', 'nifty 200', 'nifty 500', 'india vix', 'nifty smallcap', 'nifty smlcap', 'nifty microcap', 'sensex'];

    indexCards = source.filter((item) => {
      const n = (item?.name || '').toLowerCase();
      return indexPatterns.some((p) => n === p || n.includes(p));
    });
    const priority = ['nifty 50', 'nifty next 50', 'nifty midcap 50', 'nifty bank'];
    indexCards.sort((a, b) => {
      const ia = priority.findIndex((p) => (a?.name || '').toLowerCase().includes(p));
      const ib = priority.findIndex((p) => (b?.name || '').toLowerCase().includes(p));
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
    indexCards = indexCards.slice(0, 3);

    smallcapCards = source.filter((item) => {
      const n = (item?.name || '').toLowerCase();
      return smallcapPatterns.some((p) => n.includes(p));
    });
    smallcapCards = smallcapCards.slice(0, 6);
  }

  return {
    indexCards: normalizeCards(indexCards),
    smallcapCards: normalizeCards(smallcapCards)
  };
};

export const fetchMarketIndices = async () => {
  const data = await apiGet(MARKET_INDICES_ENDPOINT, FETCH_NO_STORE);
  return normalizeMarketIndicesResponse(data);
};

const fmtPerf = (v) => {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return '—';
  // Hyphen must be first/last in `[]` or escaped — `.-+` is parsed as an invalid range.
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.eE+-]/g, ''));
  if (!Number.isFinite(n)) return '—';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
};

const mapTableRow = (item, idx) => {
  if (!item || typeof item !== 'object') return null;
  const name = item.name ?? item.title ?? item.index ?? item.label ?? '';
  if (!name) return null;
  const trend = deriveTrend(item);

  const perf1dTitle =
    item.perf_1d_source != null
      ? [
          `source: ${item.perf_1d_source}`,
          `eod (candle merge): ${fmtPerf(item.perf_1d_eod)}`,
          `live numerator merge: ${fmtPerf(item.perf_1d_live)}`,
        ].join('\n')
      : undefined;

  // 1D column: show API `perf_1d` only (no coalescing / threshold filtering in the UI).
  return {
    id: item.id ?? idx + 1,
    name,
    trend: trend.label,
    trendDirection: trend.direction,
    value: formatValue(item.value ?? item.cmp ?? item.close ?? item.last),
    // Do not fall back to percentage_change — that breaks India VIX "Percentile" vs daily %.
    percentile: formatPercentile(item.percentile),
    day1d: fmtPerf(item.perf_1d),
    perf1dTitle,
    week1w: fmtPerf(item.perf_1w ?? item.week1w ?? item['1w']),
    month1m: fmtPerf(item.perf_1m ?? item.month1m ?? item['1m']),
    month3m: fmtPerf(item.perf_3m ?? item.month3m ?? item['3m']),
    month6m: fmtPerf(item.perf_6m ?? item.month6m ?? item['6m']),
    year1y: fmtPerf(item.perf_1y ?? item.year1y ?? item['1y']),
    year3y: fmtPerf(item.perf_3y ?? item.year3y ?? item['3y']),
  };
};

export const fetchMarketIndicesTable = async (options = {}) => {
  const { diagnose1d = false } = options;
  const q = diagnose1d ? '?diagnose_1d=true' : '';
  const data = await apiGet(`${MARKET_INDICES_ENDPOINT}${q}`, FETCH_NO_STORE);
  const source = extractArray(data);
  return source.map(mapTableRow).filter(Boolean);
};

export const fetchMarketIndexByName = async (name) => {
  if (!name) {
    throw new Error('Index name is required.');
  }
  const endpoint = `${MARKET_INDICES_ENDPOINT}${encodeURIComponent(name)}`;
  const data = await apiGet(endpoint, FETCH_NO_STORE);
  return normalizeMarketIndicesResponse(data);
};
