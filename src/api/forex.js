import { apiGet } from './apiClient';

export const fetchForexRates = () => apiGet('/forex/rates');

export const fetchForexHistory = (pair = 'USD/INR', days = 30) =>
  apiGet(`/forex/history?pair=${encodeURIComponent(pair)}&days=${days}`);

export const fetchCurrencyFutures = (symbol = 'USDINR') =>
  apiGet(`/forex/futures?symbol=${encodeURIComponent(symbol)}`);
