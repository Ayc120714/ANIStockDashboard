import {apiGet} from '@core/api/apiClient';
import {
  flattenSubsectorOutlookPayload,
  normalizeMarketIndicesTablePayload,
  normalizeSectorOutlookPayload,
} from '@core/utils/outlookPayload';

export const dashboardService = {
  fetchMarketIndices: async (opts = {}) => normalizeMarketIndicesTablePayload(await apiGet('/market-indices/', opts)),
  fetchMarketIndicesRaw: (opts = {}) => apiGet('/market-indices/', opts),
  fetchWatchlist: (opts = {}) => apiGet('/watchlist', opts),
  fetchWatchlistSignals: (opts = {}) => apiGet('/watchlist/signals', opts),
  fetchWatchlistWeeklyIndicators: (opts = {}) => apiGet('/watchlist/weekly-indicators', opts),
  fetchWatchlistOrderBlocks: (opts = {}) => apiGet('/watchlist/order-blocks', opts),
  fetchSectorOutlook: async (opts = {}) => normalizeSectorOutlookPayload(await apiGet('/sector-outlook', opts)),
  fetchPriceShockers: ({type = 'gainers', period = 'day', timeoutMs} = {}) =>
    apiGet(
      `/stocks/price-shockers?type=${encodeURIComponent(type)}&period=${encodeURIComponent(period)}`,
      timeoutMs ? {timeoutMs} : {},
    ),
  fetchAdvisorAlerts: (opts = {}) => apiGet('/advisor/alerts', opts),
  fetchAdvisorRatings: () => apiGet('/advisor/ratings'),
  fetchSystemStatus: () => apiGet('/system/status'),
  fetchSystemReadiness: () => apiGet('/system/readiness'),
  fetchAlgoReadyGate: () => apiGet('/system/algo-ready'),
  fetchSubsectorOutlook: async () =>
    flattenSubsectorOutlookPayload(await apiGet('/subsector-outlook/grouped')),
  fetchFiiDii: ({days = 20} = {}) => apiGet(`/fii-dii/?days=${encodeURIComponent(String(days))}`),
  fetchTrending: (limit = 40) => apiGet(`/stocks/trending?limit=${encodeURIComponent(String(limit))}`),
  fetchVolumeShockers: ({limit = 40, period = 'day'} = {}) =>
    apiGet(
      `/stocks/volume-shockers?limit=${encodeURIComponent(String(limit))}&period=${encodeURIComponent(period)}`,
    ),
  fetchWeeklyPicks: () => apiGet('/stocks/weekly-picks'),
  fetchTopTradedVolume: (limit = 40) =>
    apiGet(`/stocks/volume/top-traded?limit=${encodeURIComponent(String(limit))}`),
  fetchWatchlistByListType: listType =>
    apiGet(`/watchlist?list_type=${encodeURIComponent(String(listType || ''))}`),
  fetchAvailableSymbols: () => apiGet('/watchlist/available-symbols'),
  fetchIpos: ({status, limit = 120} = {}) => {
    const q = new URLSearchParams();
    q.set('limit', String(limit));
    if (status) q.set('status', status);
    return apiGet(`/ipo?${q.toString()}`);
  },
  fetchRelativePerformance: ({period = '1w', limit = 50} = {}) =>
    apiGet(
      `/stocks/relative-performance?period=${encodeURIComponent(period)}&limit=${encodeURIComponent(String(limit))}`,
    ),
  fetchSubsectorOutlookGrouped: () => apiGet('/subsector-outlook/grouped'),
};
