import {apiGet, apiPost} from '@core/api/apiClient';
import {API_TIMEOUT_MS} from '@core/config/apiTimeouts';
import {mergeApiOpts} from '@core/utils/screenDataFetch';
import {
  flattenSubsectorOutlookPayload,
  normalizeMarketIndicesTablePayload,
  normalizeSectorOutlookPayload,
} from '@core/utils/outlookPayload';
import {normalizeMarketIndicesCards} from '@core/utils/marketIndicesCards';
import {
  parseAlertsResponse,
  parseAvailableSymbolsResponse,
  parseIpoResponse,
  parseOrderBlocksResponse,
  parseRatingsResponse,
  parseScreenDatesResponse,
  parseStocksListResponse,
  parseWatchlistResponse,
  parseWatchlistSignalsResponse,
  parseWeeklyIndicatorsResponse,
  parseWeeklyPicksResponse,
} from '@core/utils/webParity';

const T = API_TIMEOUT_MS;

function watchlistUrl(opts = {}) {
  const params = new URLSearchParams();
  if (opts.listType) params.set('list_type', String(opts.listType));
  if (opts.includeAll) params.set('include_all', 'true');
  if (opts.cacheBust) params.set('_', String(Date.now()));
  const qs = params.toString();
  return qs ? `/watchlist?${qs}` : '/watchlist';
}

export const dashboardService = {
  fetchMarketIndices: async (opts = {}) =>
    normalizeMarketIndicesTablePayload(
      await apiGet('/market-indices/', mergeApiOpts(opts, T.screenHeavy)),
    ),
  fetchMarketIndicesCards: async (opts = {}) =>
    normalizeMarketIndicesCards(await apiGet('/market-indices/', mergeApiOpts(opts, T.screenHeavy))),
  fetchMarketIndicesRaw: (opts = {}) => apiGet('/market-indices/', mergeApiOpts(opts, T.screenHeavy)),
  /** Same as web `fetchWatchlist` — returns row array. */
  fetchWatchlist: async (opts = {}) =>
    parseWatchlistResponse(await apiGet(watchlistUrl(opts), mergeApiOpts(opts, T.screen))),
  fetchWatchlistSignals: async (opts = {}) => {
    const params = new URLSearchParams();
    if (opts?.timeframe) params.set('timeframe', String(opts.timeframe).toLowerCase());
    if (opts?.includeAll) params.set('include_all', 'true');
    const qs = params.toString();
    const path = qs ? `/watchlist/signals?${qs}` : '/watchlist/signals';
    return parseWatchlistSignalsResponse(await apiGet(path, mergeApiOpts(opts, T.screen)));
  },
  fetchWatchlistWeeklyIndicators: async (opts = {}) => {
    const includeAll = opts?.includeAll ? '?include_all=true' : '';
    return parseWeeklyIndicatorsResponse(
      await apiGet(`/watchlist/weekly-indicators${includeAll}`, mergeApiOpts(opts, T.screen)),
    );
  },
  fetchWatchlistOrderBlocks: async (opts = {}) => {
    const includeAll = opts?.includeAll ? '?include_all=true' : '';
    return parseOrderBlocksResponse(
      await apiGet(`/watchlist/order-blocks${includeAll}`, mergeApiOpts(opts, T.screen)),
    );
  },
  fetchSectorOutlook: async (opts = {}) =>
    normalizeSectorOutlookPayload(await apiGet('/sector-outlook', mergeApiOpts(opts, T.screen))),
  fetchPriceShockers: async ({type = 'gainers', period = 'day', limit = 8, date, timeoutMs} = {}) => {
    const q = new URLSearchParams({
      type: String(type),
      period: String(period),
      limit: String(limit),
    });
    if (date) q.set('date', String(date));
    return parseStocksListResponse(
      await apiGet(`/stocks/price-shockers?${q}`, {timeoutMs: timeoutMs ?? T.screenHeavy}),
    );
  },
  fetchAdvisorAlerts: async ({limit, timeoutMs, ...opts} = {}) => {
    const q = limit != null ? `?limit=${encodeURIComponent(String(limit))}` : '';
    return parseAlertsResponse(
      await apiGet(`/advisor/alerts${q}`, {...opts, timeoutMs: timeoutMs ?? T.screen, cache: 'no-store'}),
    );
  },
  fetchAdvisorRatings: async ({limit, recommendation, horizon, timeoutMs, ...opts} = {}) => {
    const params = new URLSearchParams();
    if (recommendation) params.set('recommendation', String(recommendation));
    if (horizon) params.set('horizon', String(horizon));
    if (limit != null) params.set('limit', String(limit));
    const qs = params.toString();
    return parseRatingsResponse(
      await apiGet(`/advisor/ratings${qs ? `?${qs}` : ''}`, {...opts, timeoutMs: timeoutMs ?? T.screen}),
    );
  },
  fetchSystemStatus: (opts = {}) => apiGet('/system/status', mergeApiOpts(opts, T.default)),
  fetchSystemReadiness: (opts = {}) => apiGet('/system/readiness', mergeApiOpts(opts, T.default)),
  fetchAlgoReadyGate: (opts = {}) => apiGet('/system/algo-ready', mergeApiOpts(opts, T.default)),
  fetchSubsectorOutlook: async (opts = {}) =>
    flattenSubsectorOutlookPayload(
      await apiGet('/subsector-outlook/grouped', mergeApiOpts(opts, T.screenHeavy)),
    ),
  fetchSubsectorOutlookGrouped: async (opts = {}) => {
    const resp = await apiGet('/subsector-outlook/grouped', mergeApiOpts(opts, T.screenHeavy));
    if (resp && typeof resp === 'object' && Array.isArray(resp.data)) {
      return {weekLabels: resp.weekLabels || [], data: resp.data};
    }
    return {weekLabels: [], data: []};
  },
  fetchStocksForSubsector: async (subsectorName, page = 1, pageSize = 25, opts = {}) => {
    const hydrate = opts.hydrateMarketFields === true ? 'true' : 'false';
    const q = new URLSearchParams({
      subsector: String(subsectorName),
      page: String(page),
      page_size: String(pageSize),
      hydrate_market_fields: hydrate,
    });
    const resp = await apiGet(`/subsector-stocks?${q}`, mergeApiOpts(opts, T.screenHeavy));
    return {
      data: parseStocksListResponse(resp),
      total: Number(resp?.total || 0),
      page: Number(resp?.page || page),
      pageSize: Number(resp?.page_size || pageSize),
    };
  },
  fetchStocksBySubsector: async (subsector, limit = 200, opts = {}) => {
    try {
      const data = await apiGet(
        `/stocks/by-subsector?subsector=${encodeURIComponent(subsector)}&limit=${limit}`,
        mergeApiOpts(opts, T.screenHeavy),
      );
      return parseStocksListResponse(data);
    } catch (_) {
      try {
        const data = await apiGet(
          `/stocks?subsector=${encodeURIComponent(subsector)}&limit=${limit}`,
          mergeApiOpts(opts, T.screenHeavy),
        );
        const list = parseStocksListResponse(data);
        const needle = String(subsector).toLowerCase().trim();
        return list.filter(s => String(s?.subsector || '').toLowerCase().trim() === needle);
      } catch (__) {
        return [];
      }
    }
  },
  fetchFiiDii: ({days = 20, timeoutMs} = {}) =>
    apiGet(`/fii-dii/?days=${encodeURIComponent(String(days))}`, {timeoutMs: timeoutMs ?? T.screen}),
  fetchTrending: async (limit = 40, opts = {}) => {
    const q = new URLSearchParams({limit: String(limit)});
    if (opts?.date) q.set('date', String(opts.date));
    return parseStocksListResponse(
      await apiGet(`/stocks/trending?${q}`, {
        ...opts,
        timeoutMs: opts?.timeoutMs ?? T.screenHeavy,
      }),
    );
  },
  fetchScreenDates: async (opts = {}) =>
    parseScreenDatesResponse(await apiGet('/stocks/screen-dates', mergeApiOpts(opts, T.screen))),
  fetchVolumeShockers: async ({limit = 40, period = 'day', date, timeoutMs} = {}) => {
    const q = new URLSearchParams({
      limit: String(limit),
      period: String(period),
    });
    if (date) q.set('date', String(date));
    return parseStocksListResponse(
      await apiGet(`/stocks/volume-shockers?${q}`, {timeoutMs: timeoutMs ?? T.screenHeavy}),
    );
  },
  fetchWeeklyPicks: async (opts = {}) =>
    parseWeeklyPicksResponse(await apiGet('/stocks/weekly-picks', mergeApiOpts(opts, T.screen))),
  generateWeeklyPicks: async (opts = {}) =>
    apiPost('/stocks/weekly-picks/generate', null, mergeApiOpts(opts, T.screenHeavy)),
  fetchTopTradedVolume: async (limit = 40, opts = {}) =>
    parseStocksListResponse(
      await apiGet(`/stocks/volume/top-traded?limit=${encodeURIComponent(String(limit))}`, mergeApiOpts(opts, T.screen)),
    ),
  fetchWatchlistByListType: (listType, opts = {}) =>
    dashboardService.fetchWatchlist({...opts, listType}),
  fetchAvailableSymbols: async (opts = {}) =>
    parseAvailableSymbolsResponse(await apiGet('/watchlist/available-symbols', mergeApiOpts(opts, T.screen))),
  fetchIpos: async ({status, limit = 200, timeoutMs} = {}) => {
    const q = new URLSearchParams();
    q.set('limit', String(limit));
    if (status) q.set('status', status);
    return parseIpoResponse(
      await apiGet(`/ipo?${q.toString()}`, {timeoutMs: timeoutMs ?? T.screen}),
    );
  },
  fetchRelativePerformance: async ({period = '1w', limit = 50, date, timeoutMs} = {}) => {
    const q = new URLSearchParams({
      period: String(period),
      limit: String(limit),
    });
    if (date) q.set('date', String(date));
    return parseStocksListResponse(
      await apiGet(`/stocks/relative-performance?${q}`, {timeoutMs: timeoutMs ?? T.screenHeavy}),
    );
  },
};
