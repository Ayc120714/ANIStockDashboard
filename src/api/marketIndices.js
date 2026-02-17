import { apiGet } from './apiClient';

const MARKET_INDICES_ENDPOINT = '/market-indices/';

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
  return `${num.toFixed(0)}%`;
};

const formatPE = (pe) => {
  if (pe === null || pe === undefined) return '—';
  const num = typeof pe === 'number' ? pe : parseFloat(pe);
  if (isNaN(num)) return '—';
  return `${num.toFixed(1)} PE`;
};

const mapCard = (item) => {
  if (!item || typeof item !== 'object') return null;
  const title = item.title ?? item.name ?? item.index ?? item.label;
  if (!title) return null;
  return {
    title,
    trend: item.trend ?? item.trend_label ?? item.trendLabel ?? item.trend_status ?? '',
    value: formatValue(item.value ?? item.cmp ?? item.close ?? item.last ?? item.level),
    change: formatChange(
      item.percentage_change ??
      item.percentageChange ??
      item.change_pct ??
      item.changePercent ??
      item.change_percent ??
      item.change ??
      item.chg
    ),
    percentile: formatPercentile(item.percentile ?? item.percentile_value ?? item.percentileValue ?? item.percentile_pct ?? item.percentilePct),
    pe: formatPE(item.pe ?? item.pe_ratio ?? item.peRatio ?? item.peValue)
  };
};

const normalizeCards = (cards) => (Array.isArray(cards) ? cards.map(mapCard).filter(Boolean) : []);

const normalizeMarketIndicesResponse = (payload) => {
  const source = payload?.data ?? payload;
  let indexCards = source?.indexCards ?? source?.index_cards;
  let smallcapCards = source?.smallcapCards ?? source?.smallcap_cards;

  // If payload is a direct array from API, filter by name patterns (matches Samco/DB index names)
  if (Array.isArray(source)) {
    const indexPatterns = ['nifty 50', 'nifty next 50', 'nifty midcap 50', 'nifty bank'];
    const smallcapPatterns = ['nifty 100', 'nifty 200', 'nifty 500', 'india vix', 'nifty smallcap', 'nifty microcap', 'sensex'];

    indexCards = source.filter((item) => {
      const n = (item?.name || '').toLowerCase();
      return indexPatterns.some((p) => n === p || n.includes(p));
    });
    // Prefer Nifty 50, Next 50, Midcap 50 for index cards; take top 3
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
  const data = await apiGet(MARKET_INDICES_ENDPOINT);
  return normalizeMarketIndicesResponse(data);
};

export const fetchMarketIndexByName = async (name) => {
  if (!name) {
    throw new Error('Index name is required.');
  }
  const endpoint = `${MARKET_INDICES_ENDPOINT}${encodeURIComponent(name)}`;
  const data = await apiGet(endpoint);
  return normalizeMarketIndicesResponse(data);
};
