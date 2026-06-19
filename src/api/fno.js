import { apiGet, apiPost } from './apiClient';

export const fetchFnOSymbols = () => apiGet('/fno/symbols');

/** NSE series EQ from Dhan scrip master; use for cash equities (optionally excluding F&O underlyings). */
export const fetchNseEquitySymbols = ({ exclude_fno = true, search, limit = 4000 } = {}) => {
  const p = new URLSearchParams();
  p.set('exclude_fno', exclude_fno ? 'true' : 'false');
  if (search) p.set('search', String(search).trim());
  if (limit != null) p.set('limit', String(limit));
  return apiGet(`/fno/nse-equity-symbols?${p.toString()}`);
};

export const fetchExpiryDates = (symbol = 'NIFTY') =>
  apiGet(`/fno/expiry-dates?symbol=${encodeURIComponent(symbol)}`);

export const fetchFnoLiveFeedStatus = (symbol = 'NIFTY') =>
  apiGet(`/fno/live-feed-status?symbol=${encodeURIComponent(symbol)}`);

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
