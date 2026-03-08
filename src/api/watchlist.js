import { apiGet, apiPost, apiRequest } from './apiClient';

const extractRows = (payload, keys = []) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

export const fetchWatchlist = async (listType = null, options = {}) => {
  const includeAll = Boolean(options?.includeAll);
  let url = '/watchlist';
  const params = new URLSearchParams();
  if (listType) params.set('list_type', listType);
  if (includeAll) params.set('include_all', 'true');
  const qs = params.toString();
  if (qs) url += `?${qs}`;
  const data = await apiGet(url);
  return extractRows(data, ['watchlist', 'rows']);
};

export const addToWatchlist = async (symbol, listType = 'long_term', notes = '') => {
  return apiPost('/watchlist', { symbol, list_type: listType, notes });
};

export const removeFromWatchlist = async (symbol, listType = 'long_term', options = {}) => {
  const includeAll = Boolean(options?.includeAll);
  const params = new URLSearchParams();
  params.set('list_type', listType);
  if (includeAll) params.set('include_all', 'true');
  return apiRequest(`/watchlist/symbol/${encodeURIComponent(symbol)}?${params.toString()}`, { method: 'DELETE' });
};

export const bulkDeleteFromWatchlist = async (symbols, listType, options = {}) => {
  const includeAll = Boolean(options?.includeAll);
  const qs = includeAll ? '?include_all=true' : '';
  return apiPost(`/watchlist/bulk-delete${qs}`, { symbols, list_type: listType });
};

export const updateWatchlistEntry = async (symbol, data) => {
  return apiRequest(`/watchlist/symbol/${encodeURIComponent(symbol)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

export const fetchWatchlistSignals = async (options = {}) => {
  const includeAll = Boolean(options?.includeAll);
  const data = await apiGet(`/watchlist/signals${includeAll ? '?include_all=true' : ''}`);
  return extractRows(data, ['signals', 'rows']);
};

export const fetchWeeklyIndicators = async (options = {}) => {
  const includeAll = Boolean(options?.includeAll);
  const data = await apiGet(`/watchlist/weekly-indicators${includeAll ? '?include_all=true' : ''}`);
  return extractRows(data, ['weekly_indicators', 'weekly_entries', 'rows']);
};

export const fetchOrderBlocks = async (options = {}) => {
  const includeAll = Boolean(options?.includeAll);
  const data = await apiGet(`/watchlist/order-blocks${includeAll ? '?include_all=true' : ''}`);
  return extractRows(data, ['order_blocks', 'rows']);
};
