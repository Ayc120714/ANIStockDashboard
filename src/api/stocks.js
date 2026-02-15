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
  
  // Debug logging for first stock
  if (idx === 0) {
    console.log('Raw stock data structure:', {
      hasSubsector: 'subsector' in s,
      hasSector: 'sector' in s,
      subsectorValue: s.subsector,
      sectorValue: s.sector,
      symbol: s.symbol,
      allKeys: Object.keys(s).slice(0, 15)
    });
  }
  
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

export const fetchStocksBySubsector = async (subsector, limit = 200) => {
  try {
    // Try the dedicated endpoint first
    console.log('Trying /stocks/by-subsector endpoint...');
    const data = await apiGet(`/stocks/by-subsector?subsector=${encodeURIComponent(subsector)}&limit=${limit}`);
    const list = data?.data ?? [];
    console.log('Success: got', list.length, 'stocks from /stocks/by-subsector');
    return list.map((s, i) => mapStockToTable(s, i, {}));
  } catch (err) {
    console.warn(`/stocks/by-subsector failed:`, err?.message);
  }
  
  try {
    // Try generic stocks endpoint with subsector parameter
    console.log('Trying /stocks endpoint with subsector param...');
    const data = await apiGet(`/stocks?subsector=${encodeURIComponent(subsector)}&limit=${limit}`);
    const list = data?.data ?? [];
    console.log('Success: got', list.length, 'stocks from /stocks');
    return list.map((s, i) => mapStockToTable(s, i, {}));
  } catch (err) {
    console.warn(`/stocks with subsector failed:`, err?.message);
  }

  try {
    // Try fetching all stocks and filtering client-side
    console.log('Trying to fetch all stocks from /stocks/all...');
    const data = await apiGet(`/stocks/all?limit=${limit}`);
    const list = data?.data ?? [];
    console.log('Got', list.length, 'total stocks, filtering by subsector...');
    const filtered = list.filter(s => 
      s.subsector && s.subsector.toLowerCase().trim() === subsector.toLowerCase().trim()
    );
    console.log('Filtered to', filtered.length, 'stocks');
    return filtered.map((s, i) => mapStockToTable(s, i, {}));
  } catch (err) {
    console.warn(`/stocks/all failed:`, err?.message);
  }

  console.warn(`All subsector endpoints failed for "${subsector}"`);
  return [];
};
