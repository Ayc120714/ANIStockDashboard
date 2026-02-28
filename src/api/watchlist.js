import { apiGet, apiPost, apiRequest } from './apiClient';

export const fetchWatchlist = async (listType = null, options = {}) => {
  const includeAll = Boolean(options?.includeAll);
  let url = '/watchlist';
  const params = new URLSearchParams();
  if (listType) params.set('list_type', listType);
  if (includeAll) params.set('include_all', 'true');
  const qs = params.toString();
  if (qs) url += `?${qs}`;
  const data = await apiGet(url);
  return data?.data ?? [];
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
  return data?.data ?? [];
};

export const fetchWeeklyIndicators = async (options = {}) => {
  const includeAll = Boolean(options?.includeAll);
  const data = await apiGet(`/watchlist/weekly-indicators${includeAll ? '?include_all=true' : ''}`);
  return data?.data ?? [];
};

export const fetchOrderBlocks = async (options = {}) => {
  const includeAll = Boolean(options?.includeAll);
  const data = await apiGet(`/watchlist/order-blocks${includeAll ? '?include_all=true' : ''}`);
  return data?.data ?? [];
};
