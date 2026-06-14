const stripTrailingSlash = (v = '') => String(v).replace(/\/$/, '');

const DEV_DEFAULT_API_URL = 'https://www.aycindustries.com/api';
const PROD_DEFAULT_API_URL = 'https://www.aycindustries.com/api';
const DEFAULT_API_URL = __DEV__ ? DEV_DEFAULT_API_URL : PROD_DEFAULT_API_URL;

const DEFAULT_WEB_APP_URL = 'https://www.aycindustries.com';

export const env = {
  apiUrl: stripTrailingSlash(process.env.MOBILE_API_URL || DEFAULT_API_URL),
  tradeApiUrl: stripTrailingSlash(process.env.MOBILE_TRADE_API_URL || process.env.MOBILE_API_URL || DEFAULT_API_URL),
  /** Origin for loading the SPA in WebView (same routes as stockdashboard AppRouter). */
  webAppUrl: stripTrailingSlash(process.env.MOBILE_WEB_APP_URL || DEFAULT_WEB_APP_URL),
  localAuthMode: String(process.env.MOBILE_LOCAL_AUTH_MODE || '').toLowerCase() === 'true',
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
