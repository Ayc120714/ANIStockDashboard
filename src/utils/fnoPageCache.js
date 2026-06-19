import { readPageCache, writePageCache } from './pageDataCache';
import {
  CLOSED_PAGE_CACHE_MS,
  LIVE_PAGE_CACHE_MAX_AGE_MS,
  ensureMarketSession,
  getCachedMarketSession,
  shouldPollLiveMarket,
} from './marketSession';

export const FNO_PAGE_CACHE_KEY = 'ani:fno:page:v2';

const chainCacheKey = (sym, exp) => `ani:fno:chain:v2:${sym}|${exp}`;

export function fnoCacheHasChain(payload) {
  return Boolean(payload?.chainData?.chain?.length);
}

export function readFnoPageCache() {
  const hit = readPageCache(FNO_PAGE_CACHE_KEY);
  if (!hit?.data) return null;
  return { ...hit.data, updatedAt: hit.updatedAt || 0 };
}

export function writeFnoPageCache(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return;
  writePageCache(FNO_PAGE_CACHE_KEY, snapshot);
}

export function readFnoChainCache(sym, exp) {
  if (!sym || !exp) return null;
  const hit = readPageCache(chainCacheKey(sym, exp));
  if (!hit?.data?.chain?.length) return null;
  return { ...hit.data, updatedAt: hit.updatedAt || 0 };
}

export function writeFnoChainCache(sym, exp, chainPayload) {
  if (!sym || !exp || !chainPayload?.chain?.length) return;
  writePageCache(chainCacheKey(sym, exp), chainPayload);
}

/** True when revisit should refetch from network (cache missing or stale). */
export async function shouldRefreshFnoPage(updatedAt, hasChain) {
  if (!hasChain) return true;
  await ensureMarketSession();
  const live = shouldPollLiveMarket(getCachedMarketSession());
  const age = Date.now() - (Number(updatedAt) || 0);
  if (live) return age > LIVE_PAGE_CACHE_MAX_AGE_MS;
  return age > CLOSED_PAGE_CACHE_MS;
}

export function fnoMoversCacheMatches(cached, { symbol, expiry, moversFilter }) {
  return Boolean(
    cached
    && cached.symbol === symbol
    && cached.expiry === expiry
    && cached.moversFilter === moversFilter
    && Array.isArray(cached.movers)
    && cached.movers.length > 0,
  );
}
