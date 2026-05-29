import { ensureMarketSession, getCachedMarketSession } from './marketSession';
import { readPageCache, writePageCache } from './pageDataCache';

const BROKER_HOLDINGS_KEY_PREFIX = 'broker_holdings_v1';

export function brokerHoldingsCacheKey(userId) {
  return `${BROKER_HOLDINGS_KEY_PREFIX}_${String(userId || '')}`;
}

/** Legacy Dhan-only key (read/write for backward compatibility). */
export function legacyDhanPositionsKey(userId) {
  return `dhan_live_positions_${String(userId || '')}`;
}

export function readBrokerHoldingsCache(userId) {
  const wrapped = readPageCache(brokerHoldingsCacheKey(userId));
  if (wrapped?.data?.rows && Array.isArray(wrapped.data.rows)) {
    return wrapped.data;
  }
  try {
    const raw = localStorage.getItem(legacyDhanPositionsKey(userId));
    if (!raw) return null;
    const rows = JSON.parse(raw);
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return { broker: 'dhan', rows, updatedAt: 0 };
  } catch (_) {
    return null;
  }
}

export function writeBrokerHoldingsCache(userId, broker, rows) {
  const payload = {
    broker: broker || null,
    rows: Array.isArray(rows) ? rows : [],
    updatedAt: Date.now(),
  };
  writePageCache(brokerHoldingsCacheKey(userId), payload);
  if (broker === 'dhan' && payload.rows.length > 0) {
    try {
      localStorage.setItem(legacyDhanPositionsKey(userId), JSON.stringify(payload.rows));
    } catch (_) {
      /* ignore quota */
    }
  }
  return payload;
}

/**
 * During NSE market hours, broker portfolio APIs should be called fresh (not 12s GET memo).
 */
export async function shouldRefreshBrokerFromApi() {
  const session = await ensureMarketSession();
  return Boolean(session.isMarketHours && session.isTradingDay);
}

export function shouldRefreshBrokerFromApiSync() {
  const session = getCachedMarketSession();
  return Boolean(session?.isMarketHours && session?.isTradingDay);
}
