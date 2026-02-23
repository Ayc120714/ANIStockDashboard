import { apiGet, apiPost } from './apiClient';

export const fetchFnOSymbols = () => apiGet('/fno/symbols');

export const fetchExpiryDates = (symbol = 'NIFTY') =>
  apiGet(`/fno/expiry-dates?symbol=${encodeURIComponent(symbol)}`);

export const fetchOptionChain = (symbol = 'NIFTY', expiry = '') => {
  let url = `/fno/option-chain?symbol=${encodeURIComponent(symbol)}`;
  if (expiry) url += `&expiry=${encodeURIComponent(expiry)}`;
  return apiGet(url);
};

export const fetchFutureChain = (symbol = 'NIFTY') =>
  apiGet(`/fno/future-chain?symbol=${encodeURIComponent(symbol)}`);

export const fetchOptionsSummary = (symbol = 'NIFTY', expiry = '') => {
  let url = `/fno/options-summary?symbol=${encodeURIComponent(symbol)}`;
  if (expiry) url += `&expiry=${encodeURIComponent(expiry)}`;
  return apiGet(url);
};

export const fetchTopMovers = (symbol = 'NIFTY', expiry = '', showBy = 'volume') => {
  let url = `/fno/top-movers?symbol=${encodeURIComponent(symbol)}&show_by=${showBy}`;
  if (expiry) url += `&expiry=${encodeURIComponent(expiry)}`;
  return apiGet(url);
};

export const calculatePayoff = (payload) =>
  apiPost('/fno/strategy/payoff', payload);
