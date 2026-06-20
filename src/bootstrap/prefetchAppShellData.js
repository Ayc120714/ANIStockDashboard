import {
  cacheHasUsableData,
  readPageCache,
  shouldUseCachedPageDataOnly,
  writePageCache,
} from '../utils/pageDataCache';
import { fetchSectorOutlook } from '../api/sectorOutlook';
import { fetchSubsectorOutlook } from '../api/subsectorOutlook';
import { fetchMarketIndices, fetchMarketIndicesTable } from '../api/marketIndices';
import { fetchFiiDiiActivity } from '../api/fiiDii';
import { fetchWeeklyPicks, fetchTrending, fetchPriceShockers, fetchVolumeShockers } from '../api/stocks';
import { ensureMarketSession } from '../utils/marketSession';

const MARKET_OUTLOOK_CACHE_KEY = 'marketOutlookData_v3';
const FII_DII_CACHE_KEY = 'marketOutlookFiiDii_v2';
const SECTOR_CACHE_KEY = 'sectorOutlookData';
const SUBSECTOR_CACHE_KEY = 'subsectorOutlookData_v3';
const AI_PICKS_CACHE_KEY = 'aiWeeklyPicks_v1';

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

/**
 * Background warm of main tab caches after login so navigation reuses sessionStorage
 * until logout or browser tab close.
 */
export async function prefetchAppShellData() {
  if (inflight) return inflight;

  inflight = (async () => {
    await ensureMarketSession();

    const jobs = [
      () => warmCacheIfNeeded(MARKET_OUTLOOK_CACHE_KEY, async () => {
        const [indices, tableData] = await Promise.all([
          fetchMarketIndices(),
          fetchMarketIndicesTable(),
        ]);
        return { indices, tableData };
      }, (data) => Boolean(data?.indices?.length || data?.tableData?.length)),
      () => warmCacheIfNeeded(FII_DII_CACHE_KEY, () => fetchFiiDiiActivity(20)),
      () => warmCacheIfNeeded(SECTOR_CACHE_KEY, fetchSectorOutlook, (rows) => Array.isArray(rows) && rows.length > 0),
      () => warmCacheIfNeeded(SUBSECTOR_CACHE_KEY, fetchSubsectorOutlook),
      () => warmCacheIfNeeded(
        AI_PICKS_CACHE_KEY,
        fetchWeeklyPicks,
        (data) => Boolean(data?.bullish?.length || data?.bearish?.length),
      ),
      () => warmCacheIfNeeded(
        'trendingStocksData_v3_50',
        () => fetchTrending(50),
        (rows) => Array.isArray(rows) && rows.length > 0,
      ),
      () => warmCacheIfNeeded(
        'priceShockersData_v4_gainers_day',
        () => fetchPriceShockers('gainers', 50, 'day'),
        (rows) => Array.isArray(rows) && rows.length > 0,
      ),
      () => warmCacheIfNeeded(
        'volumeShockersData_v5_default_day_50',
        () => fetchVolumeShockers(50, 'day'),
        (rows) => Array.isArray(rows) && rows.length > 0,
      ),
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
