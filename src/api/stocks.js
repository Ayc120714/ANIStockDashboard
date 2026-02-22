import { apiGet, apiPost } from './apiClient';

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

  const volJump = (s.volume && s.avg_volume && s.avg_volume > 0)
    ? (s.volume / s.avg_volume).toFixed(1) + 'x'
    : '—';

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
    volume: s.volume != null ? s.volume.toLocaleString('en-IN') : '—',
    avgVolume: s.avg_volume != null ? Math.round(s.avg_volume).toLocaleString('en-IN') : '—',
    volJump,
    date: s.last_updated,
  };
};

export const fetchRelativePerformance = async (period = '1d', limit = 50, dateStr = null) => {
  let url = `/stocks/relative-performance?period=${period}&limit=${limit}`;
  if (dateStr) url += `&date=${dateStr}`;
  const data = await apiGet(url);
  const list = data?.data ?? [];
  return list.map((s, i) => mapStockToTable(s, i, { period }));
};

export const fetchVolumeShockers = async (limit = 50, period = 'day', dateStr = null) => {
  let url = `/stocks/volume-shockers?limit=${limit}&period=${period}`;
  if (dateStr) url += `&date=${dateStr}`;
  const data = await apiGet(url);
  const list = data?.data ?? [];
  const volChgFieldMap = { day: 'percent_change_volume_1d', week: 'percent_change_volume_1w', month: 'percent_change_volume_1m' };
  const priceChgFieldMap = { day: 'day1d', week: 'week1w', month: 'month1m' };
  const volChgField = volChgFieldMap[period] || 'percent_change_volume_1d';
  const priceChgField = priceChgFieldMap[period] || 'day1d';
  return list.map((s, i) => ({
    ...mapStockToTable(s, i, {}),
    volChgPct: s[volChgField] != null ? `${s[volChgField] >= 0 ? '+' : ''}${Number(s[volChgField]).toFixed(1)}%` : '—',
    volChgRaw: s[volChgField],
    chg: formatPercent(s[priceChgField]),
    chgRaw: s[priceChgField],
  }));
};

export const fetchPriceShockers = async (type = 'gainers', limit = 50, period = 'day', dateStr = null) => {
  let url = `/stocks/price-shockers?type=${type}&limit=${limit}&period=${period}`;
  if (dateStr) url += `&date=${dateStr}`;
  const data = await apiGet(url);
  const list = data?.data ?? [];
  const periodFieldMap = { day: 'day1d', week: 'week1w', month: 'month1m' };
  const chgField = periodFieldMap[period] || 'day1d';
  return list.map((s, i) => ({
    ...mapStockToTable(s, i, {}),
    chg: formatPercent(s[chgField]),
  }));
};

export const fetchTrending = async (limit = 50, dateStr = null) => {
  let url = `/stocks/trending?limit=${limit}`;
  if (dateStr) url += `&date=${dateStr}`;
  const data = await apiGet(url);
  const list = data?.data ?? [];
  return list.map((s, i) => mapStockToTable(s, i, {}));
};

export const fetchScreenDates = async () => {
  const data = await apiGet('/stocks/screen-dates');
  return data?.dates ?? [];
};

export const fetchIPOs = async (status = null, limit = 100) => {
  let url = `/ipo?limit=${limit}`;
  if (status) url += `&status=${encodeURIComponent(status)}`;
  const data = await apiGet(url);
  return data?.data ?? [];
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

export const fetchWeeklyPicks = async () => {
  return apiGet('/stocks/weekly-picks');
};

export const triggerWeeklyPicks = async () => {
  return apiPost('/stocks/weekly-picks/run');
};

export const generateWeeklyPicks = async () => {
  return apiPost('/stocks/weekly-picks/generate');
};
