const stripTrailingSlash = (v = '') => String(v).replace(/\/$/, '');

const DEFAULT_API_URL = 'https://your-domain.example.com/api';

export const env = {
  apiUrl: stripTrailingSlash(process.env.MOBILE_API_URL || DEFAULT_API_URL),
  tradeApiUrl: stripTrailingSlash(process.env.MOBILE_TRADE_API_URL || process.env.MOBILE_API_URL || DEFAULT_API_URL),
};

export const buildUrl = (baseUrl, endpoint = '') => {
  if (!endpoint) {
    return stripTrailingSlash(baseUrl);
  }
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  const base = stripTrailingSlash(baseUrl);
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${base}${path}`;
};
