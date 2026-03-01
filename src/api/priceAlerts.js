import { apiGet, apiPost, apiRequest } from './apiClient';

const withUser = (userId, extra = {}) => {
  const q = new URLSearchParams();
  q.set('user_id', String(userId || ''));
  Object.entries(extra).forEach(([k, v]) => {
    if (v == null || v === '') return;
    q.set(k, String(v));
  });
  return q.toString();
};

export const fetchPriceAlerts = async ({ userId, listType, activeOnly = true }) => {
  if (!userId) return [];
  const query = withUser(userId, { list_type: listType, active_only: String(Boolean(activeOnly)) });
  const data = await apiGet(`/price-alerts?${query}`);
  return data?.data ?? [];
};

export const upsertPriceAlert = async ({ userId, listType, symbol, direction, thresholdPrice, isActive = true }) => {
  return apiPost('/price-alerts', {
    user_id: userId,
    list_type: listType,
    symbol,
    direction,
    threshold_price: Number(thresholdPrice),
    is_active: Boolean(isActive),
  });
};

export const deletePriceAlert = async ({ userId, alertId }) => {
  const query = withUser(userId);
  return apiRequest(`/price-alerts/${encodeURIComponent(alertId)}?${query}`, { method: 'DELETE' });
};

export const checkPriceAlerts = async ({ userId, listType, prices }) => {
  return apiPost('/price-alerts/check', {
    user_id: userId,
    list_type: listType,
    prices: prices || {},
  });
};

export const fetchPriceAlertTriggers = async ({ userId, limit = 50 }) => {
  if (!userId) return [];
  const query = withUser(userId, { limit });
  const data = await apiGet(`/price-alerts/triggers?${query}`);
  return data?.data ?? [];
};

export const deletePriceAlertTrigger = async ({ userId, triggerId }) => {
  const query = withUser(userId);
  return apiRequest(`/price-alerts/triggers/${encodeURIComponent(triggerId)}?${query}`, { method: 'DELETE' });
};

export const clearPriceAlertTriggers = async ({ userId }) => {
  const query = withUser(userId);
  return apiRequest(`/price-alerts/triggers?${query}`, { method: 'DELETE' });
};
