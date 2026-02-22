import { apiGet, apiPost, apiRequest } from './apiClient';

export const fetchRatings = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.recommendation) params.set('recommendation', filters.recommendation);
  if (filters.horizon) params.set('horizon', filters.horizon);
  if (filters.limit) params.set('limit', filters.limit);
  const qs = params.toString();
  const data = await apiGet(`/advisor/ratings${qs ? '?' + qs : ''}`);
  return data?.data ?? [];
};

export const fetchRating = async (symbol) => {
  return apiGet(`/advisor/ratings/${symbol}`);
};

export const fetchLatestSignals = async (limit = 50) => {
  const data = await apiGet(`/advisor/signals/latest?limit=${limit}`);
  return data?.data ?? [];
};

export const fetchSignals = async (symbol, limit = 10) => {
  const data = await apiGet(`/advisor/signals/${symbol}?limit=${limit}`);
  return data?.data ?? [];
};

export const fetchFundamentals = async (symbol) => {
  const data = await apiGet(`/advisor/fundamentals/${symbol}`);
  return data?.data ?? [];
};

export const fetchAnalysis = async (symbol) => {
  const data = await apiGet(`/advisor/analysis/${symbol}`);
  return data?.data ?? [];
};

export const triggerAnalysis = async (symbol, analysisType = 'earnings') => {
  return apiPost(`/advisor/analyze/${symbol}?analysis_type=${analysisType}`, {});
};

export const compareStocks = async (symbols) => {
  return apiPost('/advisor/compare', { symbols });
};

export const fetchAlerts = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.source) params.set('source', filters.source);
  if (filters.severity) params.set('severity', filters.severity);
  if (filters.symbol) params.set('symbol', filters.symbol);
  if (filters.limit) params.set('limit', filters.limit);
  const qs = params.toString();
  const data = await apiGet(`/advisor/alerts${qs ? '?' + qs : ''}`);
  return data?.data ?? [];
};

export const markAlertRead = async (alertId) => {
  return apiRequest(`/advisor/alerts/${alertId}/read`, { method: 'PUT' });
};

export const fetchPortfolioHealth = async (symbols) => {
  const data = await apiGet(`/advisor/portfolio-health?symbols=${symbols.join(',')}`);
  return data?.result ?? null;
};

export const refreshAdvisor = async () => {
  return apiGet('/advisor/refresh');
};
