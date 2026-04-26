import {apiGet, apiPost, apiRequest} from '@core/api/apiClient';

export const alertsService = {
  fetchPriceAlerts: () => apiGet('/price-alerts'),
  createPriceAlert: payload => apiPost('/price-alerts', payload),
  updatePriceAlert: (id, payload) => apiPost(`/price-alerts/${encodeURIComponent(String(id))}`, payload),
  deletePriceAlert: id => apiRequest(`/price-alerts/${encodeURIComponent(String(id))}`, {method: 'DELETE'}),
  fetchAdvisorAlerts: () => apiGet('/advisor/alerts'),
};
