/**
 * Live-read policy for web and mobile.
 * Redis on the API is the shared cache. Clients must not keep HTTP/GET copies
 * during a live NSE session, or screens show stale scanner/ML data.
 */
export const LIVE_FETCH_CACHE_MODE = 'no-store';

/** Default in-memory GET memo while market is live (0 = always hit the API). */
export const LIVE_GET_CACHE_MS_DEFAULT = 0;

/** Page snapshot older than this during live session is stale. */
export const LIVE_PAGE_CACHE_MAX_AGE_MS = 8_000;

export function resolveFetchCacheMode({ skipCache = false, getCacheTtlMs = 0, explicit } = {}) {
  if (explicit) return explicit;
  if (skipCache === true || Number(getCacheTtlMs) <= 0) return LIVE_FETCH_CACHE_MODE;
  return undefined;
}
