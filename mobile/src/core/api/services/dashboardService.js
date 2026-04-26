import {apiGet} from '@core/api/apiClient';

export const dashboardService = {
  fetchMarketIndices: () => apiGet('/market-indices/'),
  fetchWatchlist: () => apiGet('/watchlist'),
  fetchWatchlistSignals: () => apiGet('/watchlist/signals'),
  fetchWatchlistWeeklyIndicators: () => apiGet('/watchlist/weekly-indicators'),
  fetchWatchlistOrderBlocks: () => apiGet('/watchlist/order-blocks'),
  fetchSectorOutlook: () => apiGet('/sector-outlook'),
  fetchPriceShockers: () => apiGet('/stocks/price-shockers'),
  fetchAdvisorAlerts: () => apiGet('/advisor/alerts'),
  fetchAdvisorRatings: () => apiGet('/advisor/ratings'),
  fetchSystemStatus: () => apiGet('/system/status'),
  fetchSystemReadiness: () => apiGet('/system/readiness'),
};
