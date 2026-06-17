/**
 * Warm AsyncStorage page caches after login so every main tab has data on first open
 * (especially off-market / weekend when API data is static EOD snapshots).
 */
import {dashboardService} from '@core/api/services/dashboardService';
import {advisorService} from '@core/api/services/advisorService';
import {API_TIMEOUT_MS} from '@core/config/apiTimeouts';
import {extractApiRows} from '@core/utils/apiPayload';
import {MOBILE_SCREEN_LIST_LIMIT, MOBILE_SIGNALS_TAB_LIMIT} from '@core/utils/advisorWebParity';
import {MIN_FII_DII_DAYS} from '@core/utils/fiiDiiPayload';
import {normalizeMarketIndicesCards} from '@core/utils/marketIndicesCards';
import {parseStockListResponse} from '@core/utils/stockListPayload';
import {MOBILE_PAGE_CACHE_KEYS} from '@core/utils/dashboardCachePolicy';
import {
  fetchAdvisorChartPayload,
  fetchAdvisorSignalsPayload,
  fetchAdvisorTrendPayload,
  fetchMobileSignalsTabRows,
  hasUsableAdvisorChartPayload,
  hasUsableAdvisorSignalsPayload,
  hasUsableAdvisorTrendPayload,
} from '@core/utils/advisorHubCache';
import {cacheHasUsableData, readPageCache, writePageCache} from '@core/storage/pageCache';
import {fetchWithRetry} from '@core/utils/fetchWithRetry';
import {ensureMarketSession} from '@core/utils/marketSession';

const T = API_TIMEOUT_MS.screen;
const HEAVY = API_TIMEOUT_MS.screenHeavy;

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

async function warmCacheIfNeeded(cacheKey, fetcher, hasUsable = cacheHasUsableData) {
  const cached = await readPageCache(cacheKey);
  if (cached?.data != null && hasUsable(cached.data)) {
    return false;
  }
  const fresh = await fetchWithRetry(fetcher, {retries: 1});
  await writePageCache(cacheKey, fresh);
  return true;
}

async function prefetchStocksOutlookTab(tab) {
  const cacheKey = MOBILE_PAGE_CACHE_KEYS.stocksOutlook(tab);
  return warmCacheIfNeeded(
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
      const grouped = await dashboardService.fetchSubsectorOutlookGrouped({timeoutMs: HEAVY});
      return {indices: [], fii: null, sectorRows: [], grouped};
    },
    data => outlookHasUsable(tab, data),
  );
}

async function prefetchScreensHub(main, gl = 'gainers', perM = 'day', perV = 'day', alphaHor = 'short') {
  const cacheKey = MOBILE_PAGE_CACHE_KEYS.screensHub(main, gl, perM, perV, alphaHor, '', '');
  return warmCacheIfNeeded(
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
        const res = await dashboardService.fetchTrending(MOBILE_SCREEN_LIST_LIMIT, {timeoutMs: HEAVY});
        return {
          weeklyMeta: {pickDate: null, subtitle: 'Trending stocks'},
          list: Array.isArray(res) ? res : parseStockListResponse(res),
        };
      }
      if (main === 'movers') {
        const res = await dashboardService.fetchPriceShockers({
          type: gl,
          period: perM,
          limit: MOBILE_SCREEN_LIST_LIMIT,
          timeoutMs: HEAVY,
        });
        return {
          weeklyMeta: {pickDate: null, subtitle: `${gl} · ${perM}`},
          list: Array.isArray(res) ? res : parseStockListResponse(res),
        };
      }
      const res = await dashboardService.fetchVolumeShockers({limit: MOBILE_SCREEN_LIST_LIMIT, period: perV, timeoutMs: HEAVY});
      return {
        weeklyMeta: {pickDate: null, subtitle: `Volume · ${perV}`},
        list: Array.isArray(res) ? res : parseStockListResponse(res),
      };
    },
    data => Array.isArray(data?.list) && data.list.length > 0,
  );
}

async function prefetchWatchlist(listType) {
  const cacheKey = MOBILE_PAGE_CACHE_KEYS.watchlist(listType);
  return warmCacheIfNeeded(
    cacheKey,
    () => dashboardService.fetchWatchlistByListType(listType, {timeoutMs: T}),
    data => Array.isArray(data) && data.length > 0,
  );
}

async function prefetchAdvisorSignals() {
  const cacheKey = MOBILE_PAGE_CACHE_KEYS.advisorHubSignals;
  return warmCacheIfNeeded(
    cacheKey,
    () => fetchAdvisorSignalsPayload(),
    hasUsableAdvisorSignalsPayload,
  );
}

async function prefetchAdvisorTrend() {
  const cacheKey = MOBILE_PAGE_CACHE_KEYS.advisorHubTrend;
  return warmCacheIfNeeded(
    cacheKey,
    () => fetchAdvisorTrendPayload(),
    hasUsableAdvisorTrendPayload,
  );
}

async function prefetchAdvisorChart() {
  const cacheKey = MOBILE_PAGE_CACHE_KEYS.advisorHubChart;
  return warmCacheIfNeeded(
    cacheKey,
    () => fetchAdvisorChartPayload(),
    hasUsableAdvisorChartPayload,
  );
}

async function prefetchSignalsTab() {
  const cacheKey = MOBILE_PAGE_CACHE_KEYS.advisorSignals;
  return warmCacheIfNeeded(
    cacheKey,
    async () => {
      const res = await fetchMobileSignalsTabRows();
      return res;
    },
    data => Array.isArray(data) && data.length > 0,
  );
}

let inflight = null;

/**
 * Sequential background warm — respects API request gate; safe to call on every app open.
 */
export async function prefetchAppShellData() {
  if (inflight) return inflight;

  inflight = (async () => {
    await ensureMarketSession();
    const jobs = [
      () => prefetchStocksOutlookTab('market'),
      () => prefetchStocksOutlookTab('sector'),
      () => prefetchStocksOutlookTab('sub'),
      () => prefetchScreensHub('ai'),
      () => prefetchScreensHub('trending'),
      () => prefetchScreensHub('movers', 'gainers', 'day'),
      () => prefetchWatchlist('short_term'),
      () => prefetchWatchlist('long_term'),
      () => prefetchAdvisorSignals(),
      () => prefetchAdvisorTrend(),
      () => prefetchAdvisorChart(),
      () => prefetchSignalsTab(),
      () => prefetchScreensHub('volume', 'gainers', 'day', 'day'),
    ];
    for (const job of jobs) {
      try {
        await job();
      } catch {
        /* best-effort — screens still fetch on tab open if warm failed */
      }
    }
  })().finally(() => {
    inflight = null;
  });

  return inflight;
}
