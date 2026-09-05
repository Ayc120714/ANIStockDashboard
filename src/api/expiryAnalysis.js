import { apiGet, apiPost } from './apiClient';

const buildQs = (params) => {
  const q = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    q.set(key, String(value));
  });
  const s = q.toString();
  return s ? `?${s}` : '';
};

export const fetchExpiryAnalysis = (params = {}) =>
  apiGet(`/admin/expiry-analysis${buildQs(params)}`);

export const refreshExpiryAnalysis = (params = {}) =>
  apiPost(`/admin/expiry-analysis/refresh${buildQs(params)}`, {});

export const fetchExpiryWeekNews = (params = {}) =>
  apiGet(`/admin/expiry-analysis/news${buildQs(params)}`);

export const fetchExpirySymbols = (params = {}) =>
  apiGet(`/admin/expiry-analysis/symbols${buildQs(params)}`);

export const fetchExpiryUniverse = () => apiGet('/admin/expiry-analysis/universe');

export const rebuildExpiryUniverse = () => apiPost('/admin/expiry-analysis/universe/rebuild', {});

export const generateExpiryCatalyst = (body) =>
  apiPost('/admin/expiry-analysis/catalyst', body);
