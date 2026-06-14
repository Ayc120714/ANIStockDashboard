import {readPageCache, writePageCache} from '@core/storage/pageCache';
import {MOBILE_PAGE_CACHE_KEYS} from '@core/utils/dashboardCachePolicy';

const CACHE_KEY = MOBILE_PAGE_CACHE_KEYS.dashboard;

export async function readDashboardCache() {
  const cached = await readPageCache(CACHE_KEY);
  if (!cached?.data) return null;
  return {
    data: cached.data,
    brokerConnected: Boolean(cached.data.brokerConnected),
    cached_at: cached.updatedAt,
    updatedAt: cached.updatedAt,
  };
}

export async function writeDashboardCache(payload) {
  await writePageCache(CACHE_KEY, payload);
}
