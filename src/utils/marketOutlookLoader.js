import { deriveOutlookCardsFromTable, fetchMarketIndicesTable } from '../api/marketIndices';
import { fetchFiiDiiActivity } from '../api/fiiDii';
import { readPageCache, shouldUseCachedPageDataOnly, writePageCache } from './pageDataCache';

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

export function normalizeMarketOutlookPayload(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      indexCards: [],
      smallcapCards: [],
      tableData: [],
      lastRefreshedAt: null,
    };
  }

  let indexCards = Array.isArray(raw.indexCards) ? raw.indexCards : [];
  let smallcapCards = Array.isArray(raw.smallcapCards) ? raw.smallcapCards : [];
  const tableData = Array.isArray(raw.tableData) ? raw.tableData : [];

  // Legacy prefetch shape: { indices: { indexCards, smallcapCards }, tableData }
  if (raw.indices && typeof raw.indices === 'object') {
    if (!indexCards.length && Array.isArray(raw.indices.indexCards)) {
      indexCards = raw.indices.indexCards;
    }
    if (!smallcapCards.length && Array.isArray(raw.indices.smallcapCards)) {
      smallcapCards = raw.indices.smallcapCards;
    }
  }

  // Cards must match the indices table — derive from table when cards are missing or stale.
  if (tableData.length) {
    const derived = deriveOutlookCardsFromTable(tableData);
    if (derived.indexCards.length) indexCards = derived.indexCards;
    if (derived.smallcapCards.length) smallcapCards = derived.smallcapCards;
  }

  return {
    indexCards,
    smallcapCards,
    tableData,
    lastRefreshedAt: raw.lastRefreshedAt ?? null,
  };
}

export function marketOutlookHasUsable(data) {
  const normalized = normalizeMarketOutlookPayload(data);
  return Boolean(
    normalized.indexCards.length > 0
    || normalized.tableData.length > 0,
  );
}

export async function fetchMarketOutlookBundle({ miDiag = false } = {}) {
  const tableRows = await fetchMarketIndicesTable({ diagnose1d: miDiag });
  const tableData = Array.isArray(tableRows) ? tableRows : [];
  const { indexCards, smallcapCards } = deriveOutlookCardsFromTable(tableData);
  return normalizeMarketOutlookPayload({
    indexCards,
    smallcapCards,
    tableData,
    lastRefreshedAt: Date.now(),
  });
}

/** FII/DII updates after ~8 PM IST; do not freeze on 24h closed-market page cache. */
export function fiiDiiCacheIsStale(cached) {
  if (!cached?.data) return true;
  const updatedAt = Number(cached.updatedAt) || 0;
  const latestIso = cached.data?.latest_available_iso;
  if (!latestIso) return true;
  const ageMs = Date.now() - updatedAt;
  if (ageMs > 6 * 60 * 60 * 1000) return true;
  const serverDay = cached.data?.server_date_iso;
  if (serverDay && latestIso < serverDay) return true;
  return false;
}

export function fiiDiiHasUsable(data) {
  return Boolean(data && Array.isArray(data.daily) && data.daily.length > 0);
}

export async function shouldSkipFiiDiiFetch(cacheKey, cachedWrap = null) {
  const cached = cachedWrap || readPageCache(cacheKey);
  if (!cached || !fiiDiiHasUsable(cached.data)) return false;
  if (fiiDiiCacheIsStale(cached)) return false;
  return shouldUseCachedPageDataOnly(cacheKey);
}

/**
 * Load FII/DII with cache-first display and optional background refresh during live market.
 */
export async function loadFiiDiiWithCache({
  cacheKey,
  minDays,
  setData,
  setLoadState,
  forceNetwork = false,
  silent = false,
}) {
  const cached = readPageCache(cacheKey);
  const hydrated = fiiDiiHasUsable(cached?.data);

  if (hydrated) {
    setData(cached.data);
    setLoadState('done');
  } else if (!silent) {
    setLoadState('loading');
  }

  if (!forceNetwork && hydrated && (await shouldSkipFiiDiiFetch(cacheKey, cached))) {
    return;
  }

  if (!forceNetwork && hydrated) {
    void (async () => {
      try {
        const fresh = await fetchFiiDiiActivity(minDays);
        if (fiiDiiHasUsable(fresh)) {
          writePageCache(cacheKey, fresh);
          setData(fresh);
          setLoadState('done');
        }
      } catch (err) {
        console.warn('FII/DII fetch failed:', err?.message || err);
      }
    })();
    return;
  }

  try {
    const fresh = await fetchFiiDiiActivity(minDays);
    if (fiiDiiHasUsable(fresh)) {
      writePageCache(cacheKey, fresh);
      setData(fresh);
      setLoadState('done');
    } else if (!silent) {
      setLoadState('error');
    }
  } catch (err) {
    console.warn('FII/DII fetch failed:', err?.message || err);
    if (!hydrated && !silent) setLoadState('error');
  }
}

export const parseIsoLikeDate = (value) => {
  if (!value) return Number.NEGATIVE_INFINITY;
  const raw = String(value).trim();
  const dmy = raw.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (dmy) {
    const mon = MONTHS[dmy[2].toLowerCase()];
    if (mon != null) {
      return new Date(Number(dmy[3]), mon, Number(dmy[1])).getTime();
    }
  }
  const normalized = raw.replace(/\//g, '-');
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
};
