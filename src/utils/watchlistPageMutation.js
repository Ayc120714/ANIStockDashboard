import { clearApiGetCache } from '../api/apiClient';
import { readPageCache, writePageCache } from './pageDataCache';
import { applyWatchlistRowMutation, normalizeWatchlistSymbol } from './watchlistLocalMutation';

export function persistWatchlistPagePayload(cacheKey, watchlist, signals) {
  writePageCache(cacheKey, {
    watchlist: Array.isArray(watchlist) ? watchlist : [],
    signals: Array.isArray(signals) ? signals : [],
  });
}

/** Invalidate in-flight watchlist loads before optimistic UI updates. */
export function bumpWatchlistLoadGeneration(loadGenRef) {
  if (loadGenRef?.current != null) {
    loadGenRef.current += 1;
  }
}

export function collectWatchlistMutationSymbols(mutation = {}) {
  const norm = (value) => String(value || '').trim().toUpperCase();
  const removed = new Set(
    (Array.isArray(mutation.removed) ? mutation.removed : mutation.removed ? [mutation.removed] : [])
      .map(norm)
      .filter(Boolean),
  );
  const added = (Array.isArray(mutation.added) ? mutation.added : mutation.added ? [mutation.added] : [])
    .map(norm)
    .filter(Boolean);
  return { removed, added, hasChange: removed.size > 0 || added.length > 0 };
}

/**
 * Apply optimistic add/remove and persist page cache immediately so 60s poll
 * does not restore deleted rows (regression: LT/ST required hard refresh).
 */
export function computeOptimisticWatchlistMutation(rows, mutation, cacheKey, signals) {
  const next = applyWatchlistRowMutation(rows, mutation);
  persistWatchlistPagePayload(cacheKey, next, signals);
  return next;
}

export function prepareWatchlistMutationRefresh(loadGenRef) {
  bumpWatchlistLoadGeneration(loadGenRef);
  clearApiGetCache();
}

/**
 * After add/delete, optimistic cache is authoritative for membership; enrich rows from API.
 * Prevents stale API responses from re-adding deleted LT/ST symbols (regression guard).
 */
export function mergeWatchlistMembershipFromCache(apiRows, cacheRows) {
  const apiBySym = new Map();
  for (const row of apiRows || []) {
    const sym = normalizeWatchlistSymbol(row?.symbol);
    if (sym) apiBySym.set(sym, row);
  }
  const cacheList = Array.isArray(cacheRows) ? cacheRows : [];
  const orderedSyms = cacheList
    .map((row) => normalizeWatchlistSymbol(row?.symbol))
    .filter(Boolean);
  const uniqueSyms = [...new Set(orderedSyms)];

  return uniqueSyms.map((sym) => {
    if (apiBySym.has(sym)) return apiBySym.get(sym);
    const cachedRow = cacheList.find((row) => normalizeWatchlistSymbol(row?.symbol) === sym);
    return cachedRow || { symbol: sym };
  });
}

/** Resolve watchlist rows after fetch; on mutation refresh, keep optimistic membership. */
export function resolveWatchlistRowsAfterFetch(apiRows, cacheKey, { forceRefresh = false } = {}) {
  const apiWl = Array.isArray(apiRows) ? apiRows : [];
  if (!forceRefresh) return apiWl;
  const cachedWl = readPageCache(cacheKey)?.data?.watchlist;
  if (!Array.isArray(cachedWl) || cachedWl.length === 0) return apiWl;
  return mergeWatchlistMembershipFromCache(apiWl, cachedWl);
}
