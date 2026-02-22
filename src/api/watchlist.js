import { apiGet, apiPost, apiRequest } from './apiClient';

export const fetchWatchlist = async (listType = null) => {
  let url = '/watchlist';
  if (listType) url += `?list_type=${encodeURIComponent(listType)}`;
  const data = await apiGet(url);
  return data?.data ?? [];
};

export const addToWatchlist = async (symbol, listType = 'long_term', notes = '') => {
  return apiPost('/watchlist', { symbol, list_type: listType, notes });
};

export const removeFromWatchlist = async (symbol, listType = 'long_term') => {
  return apiRequest(`/watchlist/${encodeURIComponent(symbol)}?list_type=${encodeURIComponent(listType)}`, { method: 'DELETE' });
};

export const updateWatchlistEntry = async (symbol, data) => {
  return apiRequest(`/watchlist/${encodeURIComponent(symbol)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

export const fetchWatchlistSignals = async () => {
  const data = await apiGet('/watchlist/signals');
  return data?.data ?? [];
};

export const fetchWeeklyIndicators = async () => {
  const data = await apiGet('/watchlist/weekly-indicators');
  return data?.data ?? [];
};

export const fetchOrderBlocks = async () => {
  const data = await apiGet('/watchlist/order-blocks');
  return data?.data ?? [];
};
