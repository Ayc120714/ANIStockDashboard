import {readPageCache, writePageCache} from '@core/storage/pageCache';
import {extractApiRows} from '@core/utils/apiPayload';
import {MOBILE_PAGE_CACHE_KEYS} from '@core/utils/dashboardCachePolicy';

const CACHE_KEY = MOBILE_PAGE_CACHE_KEYS.advisorSignals;

export async function readAdvisorSignalsCache() {
  try {
    const cached = await readPageCache(CACHE_KEY);
    if (!cached?.data) return [];
    return extractRowArray(cached.data);
  } catch {
    return [];
  }
}

export async function writeAdvisorSignalsCache(rows) {
  await writePageCache(CACHE_KEY, Array.isArray(rows) ? rows : []);
}

function extractRowArray(data) {
  if (Array.isArray(data)) return data;
  return extractApiRows(data);
}
