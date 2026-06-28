import {
  cacheHasUsableData,
  readPageCache,
  shouldUseCachedPageDataOnly,
  writePageCache,
} from '../utils/pageDataCache';
import { fetchSectorOutlook } from '../api/sectorOutlook';
import { fetchSubsectorOutlook } from '../api/subsectorOutlook';
import { fetchMarketOutlookBundle, marketOutlookHasUsable } from '../utils/marketOutlookLoader';
import { fetchFiiDiiActivity } from '../api/fiiDii';
import { fetchWeeklyPicks, fetchTrending, fetchPriceShockers, fetchVolumeShockers } from '../api/stocks';
import { fetchWatchlist, fetchWatchlistSignals } from '../api/watchlist';
import { ensureMarketSession } from '../utils/marketSession';
import { fetchLiveSetupsPayload } from '../utils/liveSetupsPayload';
import { AI_PICKS_CACHE_KEY, LIVE_PAGE_CACHE_KEYS } from '../utils/livePageCacheKeys';

let inflight = null;

async function warmCacheIfNeeded(cacheKey, fetcher, hasUsable = cacheHasUsableData) {
  const cached = readPageCache(cacheKey);
  if (cached?.data != null && hasUsable(cached.data)) {
    return false;
  }
  const fresh = await fetcher();
  writePageCache(cacheKey, fresh);
  return true;
}

async function prefetchWatchlist(listType, cacheKey) {
  return warmCacheIfNeeded(
    cacheKey,
    async () => {
      const [watchlist, signals] = await Promise.all([
        fetchWatchlist(listType),
        fetchWatchlistSignals({ timeframe: 'intraday' }),
      ]);
      return { watchlist, signals };
    },
    (data) => Boolean(
      (Array.isArray(data?.watchlist) && data.watchlist.length > 0)
      || (Array.isArray(data?.signals) && data.signals.length > 0),
    ),
  );
}

/**
 * Background warm of main tab caches after login so navigation reuses sessionStorage
 * until logout or browser tab close (OHLCV cache-sync SPA policy).
 */
export async function prefetchAppShellData() {
  if (inflight) return inflight;

  inflight = (async () => {
    await ensureMarketSession();

    const jobs = [
      () => warmCacheIfNeeded(
        LIVE_PAGE_CACHE_KEYS.marketOutlook,
        () => fetchMarketOutlookBundle(),
        marketOutlookHasUsable,
      ),
      () => warmCacheIfNeeded(LIVE_PAGE_CACHE_KEYS.fiiDii, () => fetchFiiDiiActivity(20)),
      () => warmCacheIfNeeded(
        LIVE_PAGE_CACHE_KEYS.sectorOutlook,
        fetchSectorOutlook,
        (rows) => Array.isArray(rows) && rows.length > 0,
      ),
      () => warmCacheIfNeeded(LIVE_PAGE_CACHE_KEYS.subsectorOutlook, fetchSubsectorOutlook),
      () => warmCacheIfNeeded(
        AI_PICKS_CACHE_KEY,
        fetchWeeklyPicks,
        (data) => Boolean(data?.bullish?.length || data?.bearish?.length),
      ),
      () => warmCacheIfNeeded(
        LIVE_PAGE_CACHE_KEYS.trending(50),
        () => fetchTrending(50),
        (rows) => Array.isArray(rows) && rows.length > 0,
      ),
      () => warmCacheIfNeeded(
        LIVE_PAGE_CACHE_KEYS.priceShockers('gainers', 'day', 50),
        () => fetchPriceShockers('gainers', 50, 'day'),
        (rows) => Array.isArray(rows) && rows.length > 0,
      ),
      () => warmCacheIfNeeded(
        LIVE_PAGE_CACHE_KEYS.volumeShockers('day', 50),
        () => fetchVolumeShockers(50, 'day'),
        (rows) => Array.isArray(rows) && rows.length > 0,
      ),
      () => warmCacheIfNeeded(
        LIVE_PAGE_CACHE_KEYS.liveSetups,
        () => fetchLiveSetupsPayload(),
        (rows) => Array.isArray(rows) && rows.length > 0,
      ),
      () => prefetchWatchlist('short_term', LIVE_PAGE_CACHE_KEYS.shortTermWatchlist),
      () => prefetchWatchlist('long_term', LIVE_PAGE_CACHE_KEYS.longTermWatchlist),
    ];

    for (const job of jobs) {
      try {
        await job();
      } catch {
        /* best-effort warm */
      }
    }
  })().finally(() => {
    inflight = null;
  });

  return inflight;
}

export async function shouldHydrateFromSessionCache(cacheKey) {
  const cached = readPageCache(cacheKey);
  if (!cached?.data || !cacheHasUsableData(cached.data)) return false;
  return shouldUseCachedPageDataOnly(cacheKey);
}

export { AI_PICKS_CACHE_KEY };
