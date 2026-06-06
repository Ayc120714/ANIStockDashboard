import { ensureMarketSession } from './marketSession';
import { readPageCache, writePageCache } from './pageDataCache';
import { ensureNormalizedBrokerRows } from './brokerHoldingsNormalize';

const BROKER_HOLDINGS_KEY_PREFIX = 'broker_holdings_v2';
const LEGACY_BROKER_HOLDINGS_KEY_PREFIX = 'broker_holdings_v1';
/** Offline fallback only — live broker session should always hit APIs first. */
export const BROKER_HOLDINGS_CACHE_TTL_MS = 5 * 60_000;

export function brokerHoldingsCacheKey(userId) {
  return `${BROKER_HOLDINGS_KEY_PREFIX}_${String(userId || '')}`;
}

/** Legacy Dhan-only key (read/write for backward compatibility). */
export function legacyDhanPositionsKey(userId) {
  return `dhan_live_positions_${String(userId || '')}`;
}

export function isBrokerHoldingsCacheFresh(updatedAt) {
  if (!updatedAt) return false;
  return Date.now() - Number(updatedAt) < BROKER_HOLDINGS_CACHE_TTL_MS;
}

export function clearStaleBrokerHoldingsCaches(userId) {
  const uid = String(userId || '');
  if (!uid) return;
  try {
    sessionStorage.removeItem(
      brokerHoldingsCacheKey(uid).replace(BROKER_HOLDINGS_KEY_PREFIX, LEGACY_BROKER_HOLDINGS_KEY_PREFIX),
    );
    localStorage.removeItem(legacyDhanPositionsKey(uid));
    ['dhan', 'angelone', 'samco', 'upstox', 'kotak', 'fyers', 'zerodha'].forEach((broker) => {
      localStorage.removeItem(`broker_live_positions_${broker}_${uid}`);
      localStorage.removeItem(`broker_live_orders_${broker}_${uid}`);
      localStorage.removeItem(`broker_live_sync_${broker}_${uid}`);
    });
  } catch (_) {
    /* ignore */
  }
}

export function readBrokerHoldingsCache(userId) {
  const wrapped = readPageCache(brokerHoldingsCacheKey(userId));
  if (!wrapped?.data?.rows || !Array.isArray(wrapped.data.rows) || !wrapped.data.rows.length) {
    return null;
  }
  const updatedAt = wrapped.updatedAt || wrapped.data.updatedAt || 0;
  if (!isBrokerHoldingsCacheFresh(updatedAt)) return null;
  const rows = ensureNormalizedBrokerRows(wrapped.data.rows);
  if (!rows.length) return null;
  return { ...wrapped.data, rows, updatedAt };
}

export function writeBrokerHoldingsCache(userId, broker, rows) {
  const payload = {
    broker: broker || null,
    rows: ensureNormalizedBrokerRows(Array.isArray(rows) ? rows : []),
    updatedAt: Date.now(),
  };
  clearStaleBrokerHoldingsCaches(userId);
  writePageCache(brokerHoldingsCacheKey(userId), payload);
  return payload;
}

/** Broker portfolio must always use the active session token, not market-hours gating. */
export async function shouldRefreshBrokerFromApi() {
  await ensureMarketSession();
  return true;
}

export function shouldRefreshBrokerFromApiSync() {
  return true;
}
