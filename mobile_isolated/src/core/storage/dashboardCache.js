import {readPageCache, writePageCache} from '@core/storage/pageCache';
import {MOBILE_PAGE_CACHE_KEYS} from '@core/utils/dashboardCachePolicy';

const CACHE_KEY = MOBILE_PAGE_CACHE_KEYS.dashboard;

function unwrapPayload(node) {
  if (!node || typeof node !== 'object') return null;
  if (node.data && typeof node.data === 'object' && !Array.isArray(node.data)) {
    return node.data;
  }
  return node;
}

export async function readDashboardCache() {
  const cached = await readPageCache(CACHE_KEY);
  if (!cached?.data) return null;
  const payload = unwrapPayload(cached.data);
  if (!payload) return null;
  return {
    data: payload,
    brokerConnected: Boolean(cached.data?.brokerConnected ?? payload.brokerConnected),
    cached_at: cached.updatedAt,
    updatedAt: cached.updatedAt,
  };
}

export async function writeDashboardCache({data, brokerConnected}) {
  const payload = {
    ...(data || {}),
    brokerConnected: Boolean(brokerConnected ?? data?.brokerConnected),
  };
  await writePageCache(CACHE_KEY, payload);
}
