import {apiGet, apiPost, apiRequest} from '@core/api/apiClient';

const toQuery = params => {
  const q = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      q.append(k, String(v));
    }
  });
  const raw = q.toString();
  return raw ? `?${raw}` : '';
};

export const alertsService = {
  fetchPriceAlerts: () => apiGet('/price-alerts'),
  createPriceAlert: payload => apiPost('/price-alerts', payload),
  updatePriceAlert: (id, payload) => apiPost(`/price-alerts/${encodeURIComponent(String(id))}`, payload),
  deletePriceAlert: id => apiRequest(`/price-alerts/${encodeURIComponent(String(id))}`, {method: 'DELETE'}),
  fetchAdvisorAlerts: () => apiGet('/advisor/alerts'),
  fetchLiveAdvisorAlerts: ({source, severity, symbol, limit = 80} = {}) =>
    apiGet(`/advisor/alerts${toQuery({source, severity, symbol, limit})}`),
  fetchSpecialAlerts: ({symbol, limit = 200, currentDayOnly = true} = {}) =>
    apiGet(`/advisor/alerts/special${toQuery({symbol, limit, current_day_only: currentDayOnly})}`),
};
