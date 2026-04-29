import {apiGet, apiPost} from '@core/api/apiClient';

export const brokersService = {
  fetchBrokerOptions: () => apiGet('/brokers/options'),
  fetchBrokerSetup: () => apiGet('/brokers/setup'),
  validateBrokerSetup: payload => apiPost('/brokers/validate', payload),
  connectDhan: payload => apiPost('/brokers/dhan/connect', payload),
  fetchDhanStatus: () => apiGet('/brokers/dhan/status'),
  disconnectDhan: () => apiPost('/brokers/dhan/disconnect', {}),
  connectAngelOne: payload => apiPost('/brokers/angelone/connect', payload),
  connectZerodha: payload => apiPost('/brokers/zerodha/connect', payload),
  connectFyers: payload => apiPost('/brokers/fyers/connect', payload),
  connectUpstox: payload => apiPost('/brokers/upstox/connect', payload),
  connectKotak: payload => apiPost('/brokers/kotak/connect', payload),
  connectSamco: payload => apiPost('/brokers/samco/connect', payload),
};
