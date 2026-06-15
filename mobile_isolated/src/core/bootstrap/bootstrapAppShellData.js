/**
 * Startup: open dashboard as soon as indices + movers are ready.
 * Other tabs warm in the background (no blocking splash).
 */
import {dashboardService} from '@core/api/services/dashboardService';
import {signalsService} from '@core/api/services/signalsService';
import {API_TIMEOUT_MS} from '@core/config/apiTimeouts';
import {APP_SHELL_REFRESH_MS_CLOSED, APP_SHELL_REFRESH_MS_LIVE} from '@core/config/dataRefreshPolicy';
import {extractApiRows} from '@core/utils/apiPayload';
import {
  fetchAdvisorChartPayload,
  fetchAdvisorSignalsPayload,
  fetchAdvisorTrendPayload,
  hasUsableAdvisorChartPayload,
  hasUsableAdvisorSignalsPayload,
  hasUsableAdvisorTrendPayload,
} from '@core/utils/advisorHubCache';
import {MIN_FII_DII_DAYS} from '@core/utils/fiiDiiPayload';
import {normalizeMarketIndicesCards} from '@core/utils/marketIndicesCards';
import {parseStockListResponse} from '@core/utils/stockListPayload';
import {
  hasDashboardMovers,
  hasDashboardUsableContent,
  MOBILE_PAGE_CACHE_KEYS,
} from '@core/utils/dashboardCachePolicy';
import {readPageCache, writePageCache} from '@core/storage/pageCache';
import {fetchWithRetry} from '@core/utils/fetchWithRetry';
import {ensureMarketSession, getMarketPollingIntervalMs} from '@core/utils/marketSession';
import {readDashboardCache, writeDashboardCache} from '@core/storage/dashboardCache';

const T = API_TIMEOUT_MS.screen;
const HEAVY = API_TIMEOUT_MS.screenHeavy;
const STARTUP_MS = API_TIMEOUT_MS.startup;

const toList = raw => {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') return Object.values(raw);
  return [];
};

function outlookHasUsable(tab, data) {
  if (!data) return false;
  if (tab === 'market') return data?.indices?.length > 0 || data?.fii != null;
  if (tab === 'sector') return data?.sectorRows?.length > 0;
  return Array.isArray(data?.grouped?.data) && data.grouped.data.length > 0;
}

async function fetchAndCache(cacheKey, fetcher, hasUsable) {
  const fresh = await fetchWithRetry(fetcher, {retries: 1});
  await writePageCache(cacheKey, fresh);
  if (hasUsable && !hasUsable(fresh)) {
    throw new Error(`No usable data for ${cacheKey}`);
  }
  return fresh;
}

/** Minimum data required before showing the dashboard tab. */
export async function bootstrapCriticalDashboard({onProgress} = {}) {
  onProgress?.('Loading indices & market movers…');

  const cached = await readPageCache(MOBILE_PAGE_CACHE_KEYS.dashboard);
  if (hasDashboardUsableContent(cached?.data)) {
    return cached.data;
  }

  const legacy = await readDashboardCache();
  if (hasDashboardUsableContent(legacy?.data)) {
    return legacy.data;
  }

  const [indicesRaw, gainersRaw, losersRaw] = await Promise.all([
    dashboardService.fetchMarketIndicesCards({timeoutMs: STARTUP_MS}),
    dashboardService.fetchPriceShockers({type: 'gainers', period: 'day', limit: 8, timeoutMs: STARTUP_MS}),
    dashboardService.fetchPriceShockers({type: 'losers', period: 'day', limit: 8, timeoutMs: STARTUP_MS}),
  ]);

  const indices = Array.isArray(indicesRaw) ? indicesRaw : normalizeMarketIndicesCards(indicesRaw);
  const gainers = parseStockListResponse(gainersRaw);
  const losers = parseStockListResponse(losersRaw);

  if (!indices.length) throw new Error('Market indices unavailable');
  if (!gainers.length) throw new Error('Top gainers unavailable');
  if (!losers.length) throw new Error('Top losers unavailable');

  const payload = {
    ...(cached?.data && typeof cached.data === 'object' ? cached.data : {}),
    indices,
    gainers,
    losers,
  };

  await writePageCache(MOBILE_PAGE_CACHE_KEYS.dashboard, payload);
  await writeDashboardCache({data: payload, brokerConnected: false});
  return payload;
}

async function bootstrapDashboardExtras({onProgress}) {
  onProgress?.('Dashboard: watchlist & signals…');
  const cached = await readPageCache(MOBILE_PAGE_CACHE_KEYS.dashboard);
  const base = cached?.data && typeof cached.data === 'object' ? cached.data : {};

  const [watchlistRaw, signalsRaw] = await Promise.all([
    dashboardService.fetchWatchlist({timeoutMs: T}).catch(() => base.watchlist ?? []),
    dashboardService
      .fetchWatchlistSignals({timeframe: 'intraday', timeoutMs: T})
      .catch(() => base.signals ?? []),
  ]);

  const payload = {
    ...base,
    watchlist: Array.isArray(watchlistRaw) ? watchlistRaw : extractApiRows(watchlistRaw),
    signals: Array.isArray(signalsRaw) ? signalsRaw : extractApiRows(signalsRaw),
  };
  await writePageCache(MOBILE_PAGE_CACHE_KEYS.dashboard, payload);
  await writeDashboardCache({data: payload, brokerConnected: false});
  return payload;
}

async function bootstrapStocksOutlookTab(tab, {onProgress}) {
  onProgress?.(`Stocks: ${tab}…`);
  const cacheKey = MOBILE_PAGE_CACHE_KEYS.stocksOutlook(tab);
  const timeoutMs = tab === 'sub' ? HEAVY : T;
  return fetchAndCache(
    cacheKey,
    async () => {
      if (tab === 'market') {
        const [ixRaw, fd] = await Promise.all([
          dashboardService.fetchMarketIndicesRaw({timeoutMs: T}),
          dashboardService.fetchFiiDii({days: MIN_FII_DII_DAYS, timeoutMs: T}).catch(() => null),
        ]);
        const indices = normalizeMarketIndicesCards(ixRaw);
        return {
          indices: indices.length ? indices : toList(ixRaw),
          fii: fd,
          sectorRows: [],
          grouped: null,
        };
      }
      if (tab === 'sector') {
        const data = await dashboardService.fetchSectorOutlook({timeoutMs: T});
        return {indices: [], fii: null, sectorRows: toList(data), grouped: null};
      }
      const grouped = await dashboardService.fetchSubsectorOutlookGrouped({timeoutMs: timeoutMs});
      return {indices: [], fii: null, sectorRows: [], grouped};
    },
    data => outlookHasUsable(tab, data),
  );
}

async function bootstrapScreensHub(
  main,
  gl = 'gainers',
  perM = 'day',
  perV = 'day',
  alphaHor = 'short',
  {onProgress} = {},
) {
  onProgress?.(`Screens: ${main}…`);
  const cacheKey = MOBILE_PAGE_CACHE_KEYS.screensHub(main, gl, perM, perV, alphaHor, '', '');
  return fetchAndCache(
    cacheKey,
    async () => {
      if (main === 'ai') {
        const picks = await dashboardService.fetchWeeklyPicks({timeoutMs: HEAVY});
        const bull = Array.isArray(picks?.bullish) ? picks.bullish : [];
        const bear = Array.isArray(picks?.bearish) ? picks.bearish : [];
        return {
          weeklyMeta: {pickDate: picks?.pick_date || null, subtitle: 'Weekly AI picks — swing trade setup'},
          list: [
            {_hdr: true, _title: 'Bullish swing picks', _tone: 'bull'},
            ...bull.map((r, i) => ({...r, _n: i + 1, _side: 'bull'})),
            {_hdr: true, _title: 'Bearish swing picks', _tone: 'bear'},
            ...bear.map((r, i) => ({...r, _n: i + 1, _side: 'bear'})),
          ],
        };
      }
      if (main === 'trending') {
        const res = await dashboardService.fetchTrending(50, {timeoutMs: HEAVY});
        return {
          weeklyMeta: {pickDate: null, subtitle: 'Trending stocks'},
          list: Array.isArray(res) ? res : parseStockListResponse(res),
        };
      }
      if (main === 'movers') {
        const res = await dashboardService.fetchPriceShockers({
          type: gl,
          period: perM,
          limit: 50,
          timeoutMs: HEAVY,
        });
        return {
          weeklyMeta: {pickDate: null, subtitle: `${gl} · ${perM}`},
          list: Array.isArray(res) ? res : parseStockListResponse(res),
        };
      }
      const res = await dashboardService.fetchVolumeShockers({limit: 50, period: perV, timeoutMs: HEAVY});
      return {
        weeklyMeta: {pickDate: null, subtitle: `Volume · ${perV}`},
        list: Array.isArray(res) ? res : parseStockListResponse(res),
      };
    },
    data => Array.isArray(data?.list) && data.list.length > 0,
  );
}

async function bootstrapWatchlist(listType, {onProgress}) {
  onProgress?.(`Watchlist: ${listType}…`);
  const cacheKey = MOBILE_PAGE_CACHE_KEYS.watchlist(listType);
  return fetchAndCache(
    cacheKey,
    () => dashboardService.fetchWatchlistByListType(listType, {timeoutMs: T}),
    data => Array.isArray(data),
  );
}

async function warmSignalsBundle({onProgress}) {
  onProgress?.('Signals & Advisor…');
  const payload = await fetchAdvisorSignalsPayload();
  const rows = payload.sigRows || [];
  await writePageCache(MOBILE_PAGE_CACHE_KEYS.advisorSignals, rows);
  await writePageCache(MOBILE_PAGE_CACHE_KEYS.advisorHubSignals, payload);
  return payload;
}

async function warmAdvisorHubBundle({onProgress}) {
  onProgress?.('Advisor tables…');
  const [sigCached, trendCached, chartCached] = await Promise.all([
    readPageCache(MOBILE_PAGE_CACHE_KEYS.advisorHubSignals),
    readPageCache(MOBILE_PAGE_CACHE_KEYS.advisorHubTrend),
    readPageCache(MOBILE_PAGE_CACHE_KEYS.advisorHubChart),
  ]);

  const needSignals = !hasUsableAdvisorSignalsPayload(sigCached?.data);
  const needTrend = !hasUsableAdvisorTrendPayload(trendCached?.data);
  const needChart = !hasUsableAdvisorChartPayload(chartCached?.data);

  if (!needSignals && !needTrend && !needChart) {
    return {
      signals: sigCached.data,
      trend: trendCached.data,
      chart: chartCached.data,
    };
  }

  const [signals, trend, chart] = await Promise.allSettled([
    needSignals ? fetchAdvisorSignalsPayload() : Promise.resolve(sigCached?.data),
    needTrend ? fetchAdvisorTrendPayload({forceRefresh: false}) : Promise.resolve(trendCached?.data),
    needChart ? fetchAdvisorChartPayload({forceRefresh: false}) : Promise.resolve(chartCached?.data),
  ]);

  if (signals.status === 'fulfilled') {
    await writePageCache(MOBILE_PAGE_CACHE_KEYS.advisorSignals, signals.value.sigRows || []);
    await writePageCache(MOBILE_PAGE_CACHE_KEYS.advisorHubSignals, signals.value);
  }
  if (trend.status === 'fulfilled' && hasUsableAdvisorTrendPayload(trend.value)) {
    await writePageCache(MOBILE_PAGE_CACHE_KEYS.advisorHubTrend, trend.value);
  }
  if (chart.status === 'fulfilled' && hasUsableAdvisorChartPayload(chart.value)) {
    await writePageCache(MOBILE_PAGE_CACHE_KEYS.advisorHubChart, chart.value);
  }

  return {
    signals: signals.status === 'fulfilled' ? signals.value : null,
    trend: trend.status === 'fulfilled' ? trend.value : null,
    chart: chart.status === 'fulfilled' ? chart.value : null,
  };
}

async function bootstrapSignalsTab({onProgress}) {
  onProgress?.('Signals…');
  const cached = await readPageCache(MOBILE_PAGE_CACHE_KEYS.advisorSignals);
  if (cached?.data != null && Array.isArray(cached.data)) {
    return cached.data;
  }
  return warmSignalsBundle({onProgress});
}

async function bootstrapAdvisorHub({onProgress}) {
  onProgress?.('Advisor…');
  const [sigCached, trendCached, chartCached] = await Promise.all([
    readPageCache(MOBILE_PAGE_CACHE_KEYS.advisorHubSignals),
    readPageCache(MOBILE_PAGE_CACHE_KEYS.advisorHubTrend),
    readPageCache(MOBILE_PAGE_CACHE_KEYS.advisorHubChart),
  ]);
  const hasSignals = hasUsableAdvisorSignalsPayload(sigCached?.data);
  const hasTrend = hasUsableAdvisorTrendPayload(trendCached?.data);
  const hasChart = hasUsableAdvisorChartPayload(chartCached?.data);
  if (hasSignals && hasTrend && hasChart) {
    return {signals: sigCached.data, trend: trendCached.data, chart: chartCached.data};
  }
  return warmAdvisorHubBundle({onProgress});
}

const PARALLEL_WARM_BATCHES = [
  [
    opts => bootstrapDashboardExtras(opts),
    opts => bootstrapStocksOutlookTab('market', opts),
    opts => bootstrapStocksOutlookTab('sector', opts),
    opts => bootstrapStocksOutlookTab('sub', opts),
  ],
  [
    opts => bootstrapWatchlist('short_term', opts),
    opts => bootstrapWatchlist('long_term', opts),
    opts => bootstrapScreensHub('trending', 'gainers', 'day', 'day', 'short', opts),
    opts => bootstrapScreensHub('movers', 'gainers', 'day', 'day', 'short', opts),
  ],
  [
    opts => bootstrapScreensHub('volume', 'gainers', 'day', 'day', 'short', opts),
    opts => bootstrapScreensHub('alpha', 'gainers', 'day', 'day', 'short', opts),
    opts => bootstrapScreensHub('ai', 'gainers', 'day', 'day', 'short', opts),
  ],
];

let inflightCritical = null;
let inflightWarm = null;
let inflightSignalsWarm = null;
let refreshTimer = null;

export function startSignalsWarm({onProgress} = {}) {
  if (inflightSignalsWarm) return inflightSignalsWarm;
  inflightSignalsWarm = warmSignalsBundle({onProgress}).finally(() => {
    inflightSignalsWarm = null;
  });
  return inflightSignalsWarm;
}

export async function bootstrapAppShellData({onProgress} = {}) {
  if (inflightCritical) return inflightCritical;
  inflightCritical = bootstrapCriticalDashboard({onProgress}).finally(() => {
    inflightCritical = null;
  });
  return inflightCritical;
}

export async function warmAppShellInBackground({onProgress} = {}) {
  if (inflightWarm) return inflightWarm;

  inflightWarm = (async () => {
    await ensureMarketSession();
    try {
      await warmAdvisorHubBundle({onProgress});
    } catch {
      /* advisor warm is best-effort */
    }
    return {ok: true};
  })().finally(() => {
    inflightWarm = null;
  });

  return inflightWarm;
}

export function startAppShellAutoRefresh() {
  if (refreshTimer) return;
  const tick = async () => {
    try {
      await bootstrapCriticalDashboard();
    } catch {
      /* next tick retries */
    }
  };
  (async () => {
    await ensureMarketSession();
    const pollMs = getMarketPollingIntervalMs(APP_SHELL_REFRESH_MS_LIVE, APP_SHELL_REFRESH_MS_CLOSED);
    if (pollMs > 0) {
      refreshTimer = setInterval(tick, pollMs);
    }
  })();
}

export function stopAppShellAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}
