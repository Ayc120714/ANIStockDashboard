import { apiGet } from './apiClient';

export const fetchCommodities = () => apiGet('/commodities/');

export const fetchCommodityQuotes = () => apiGet('/commodities/quotes');

export const fetchCommodityQuote = (symbol = 'GOLDM') =>
  apiGet(`/commodities/quote?symbol=${encodeURIComponent(symbol)}`);

export const fetchCommodityOptionChain = (symbol = 'CRUDEOIL', expiry = '') => {
  let url = `/commodities/option-chain?symbol=${encodeURIComponent(symbol)}`;
  if (expiry) url += `&expiry=${encodeURIComponent(expiry)}`;
  return apiGet(url);
};
