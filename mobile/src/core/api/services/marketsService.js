import {apiGet} from '@core/api/apiClient';

export const marketsService = {
  fetchFnoSummary: () => apiGet('/fno/summary'),
  fetchCommoditiesSummary: () => apiGet('/commodities/summary'),
  fetchForexSummary: () => apiGet('/forex/summary'),
};
