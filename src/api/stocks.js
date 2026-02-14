import { apiGet } from './apiClient';

const formatCurrency = (v) => {
  if (v == null) return '—';
  const n = typeof v === 'number' ? v : parseFloat(v);
  return isNaN(n) ? '—' : `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatPercent = (v) => {
  if (v == null) return '—';
  const n = typeof v === 'number' ? v : parseFloat(v);
  if (isNaN(n)) return '—';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
};

const rsFieldByPeriod = {
  '1d': 'day1d',
  '1w': 'week1w',
  '1m': 'month1m',
  '3m': 'month3m',
  '6m': 'month6m',
  '1y': 'year1y',
  '3y': 'year3y',
};

const mapStockToTable = (s, idx, opts = {}) => {
  const rsField = rsFieldByPeriod[opts.period] || 'week1w';
  const rsVal = s[rsField] ?? s.week1w ?? s.month1m ?? s.day1d;
  return {
    id: String(idx + 1).padStart(2, '0'),
    symbol: s.symbol,
    sector: s.sector || '—',
    subSector: s.subsector || '—',
    mc: s.market_cap || '—',
    ema21: formatCurrency(s.ema21),
    ema50: formatCurrency(s.ema50),
    cmp: formatCurrency(s.price),
    chg: formatPercent(s.day1d),
    rs: formatPercent(rsVal),
    volume: s.volume != null ? s.volume.toLocaleString() : '—',
    avgVolume: '—',
    date: s.last_updated,
  };
};

export const fetchRelativePerformance = async (period = '1d', limit = 50) => {
  const data = await apiGet(`/stocks/relative-performance?period=${period}&limit=${limit}`);
  const list = data?.data ?? [];
  return list.map((s, i) => mapStockToTable(s, i, { period }));
};

export const fetchVolumeShockers = async (limit = 50) => {
  const data = await apiGet(`/stocks/volume-shockers?limit=${limit}`);
  const list = data?.data ?? [];
  return list.map((s, i) => mapStockToTable(s, i, {}));
};

export const fetchPriceShockers = async (type = 'gainers', limit = 50) => {
  const data = await apiGet(`/stocks/price-shockers?type=${type}&limit=${limit}`);
  const list = data?.data ?? [];
  return list.map((s, i) => mapStockToTable(s, i, {}));
};

export const fetchTrending = async (limit = 50) => {
  const data = await apiGet(`/stocks/trending?limit=${limit}`);
  const list = data?.data ?? [];
  return list.map((s, i) => mapStockToTable(s, i, {}));
};
