import { apiRequest } from './apiClient';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';
const TRADE_BASE_URL = process.env.REACT_APP_TRADE_API_URL || API_BASE_URL;

const buildUrlFromBase = (baseUrl, endpoint) => {
  if (!endpoint) return String(baseUrl || '');
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) return endpoint;
  const base = String(baseUrl || '').replace(/\/$/, '');
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${base}${path}`;
};

const buildTradeUrl = (endpoint) => buildUrlFromBase(TRADE_BASE_URL, endpoint);
const buildFallbackTradeUrl = (endpoint) => buildUrlFromBase(API_BASE_URL, endpoint);

export const tradeApiRequest = async (endpoint, options = {}) => {
  const primaryUrl = buildTradeUrl(endpoint);
  try {
    return await apiRequest(primaryUrl, options);
  } catch (error) {
    const primaryFailedByNetwork = String(error?.message || '').includes('Unable to reach server');
    if (!primaryFailedByNetwork) throw error;
    const fallbackUrl = buildFallbackTradeUrl(endpoint);
    if (!fallbackUrl || fallbackUrl === primaryUrl) throw error;
    return apiRequest(fallbackUrl, options);
  }
};

export const tradeApiGet = (endpoint, options = {}) =>
  tradeApiRequest(endpoint, { ...options, method: 'GET' });

export const tradeApiPost = (endpoint, body, options = {}) =>
  tradeApiRequest(endpoint, {
    ...options,
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
