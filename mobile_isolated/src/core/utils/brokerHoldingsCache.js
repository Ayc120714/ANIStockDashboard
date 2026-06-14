import {readPageCache, writePageCache} from '@core/storage/pageCache';
import {ensureNormalizedBrokerRows} from '@core/utils/brokerHoldingsNormalize';

const BROKER_HOLDINGS_KEY_PREFIX = 'broker_holdings_v2';
export const BROKER_HOLDINGS_CACHE_TTL_MS = 5 * 60_000;

export function brokerHoldingsCacheKey(userId) {
  return `${BROKER_HOLDINGS_KEY_PREFIX}_${String(userId || '')}`;
}

export function isBrokerHoldingsCacheFresh(updatedAt) {
  if (!updatedAt) return false;
  return Date.now() - Number(updatedAt) < BROKER_HOLDINGS_CACHE_TTL_MS;
}

export async function readBrokerHoldingsCache(userId) {
  const wrapped = await readPageCache(brokerHoldingsCacheKey(userId));
  if (!wrapped?.data?.rows || !Array.isArray(wrapped.data.rows) || !wrapped.data.rows.length) {
    return null;
  }
  const updatedAt = wrapped.updatedAt || wrapped.data.updatedAt || 0;
  if (!isBrokerHoldingsCacheFresh(updatedAt)) return null;
  const rows = ensureNormalizedBrokerRows(wrapped.data.rows);
  if (!rows.length) return null;
  return {...wrapped.data, rows, updatedAt};
}

export async function writeBrokerHoldingsCache(userId, broker, rows) {
  const payload = {
    broker: broker || null,
    rows: ensureNormalizedBrokerRows(Array.isArray(rows) ? rows : []),
    updatedAt: Date.now(),
  };
  await writePageCache(brokerHoldingsCacheKey(userId), payload);
  return payload;
}
