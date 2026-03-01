import { apiRequest } from './apiClient';

const TRADE_BASE_URL = process.env.REACT_APP_TRADE_API_URL || 'http://localhost:8010/api';

const buildTradeUrl = (endpoint) => {
  if (!endpoint) return TRADE_BASE_URL;
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) return endpoint;
  const base = TRADE_BASE_URL.replace(/\/$/, '');
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${base}${path}`;
};

export const tradeApiRequest = (endpoint, options = {}) => apiRequest(buildTradeUrl(endpoint), options);

export const tradeApiGet = (endpoint, options = {}) =>
  tradeApiRequest(endpoint, { ...options, method: 'GET' });

export const tradeApiPost = (endpoint, body, options = {}) =>
  tradeApiRequest(endpoint, {
    ...options,
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
