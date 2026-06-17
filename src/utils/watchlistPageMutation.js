import { clearApiGetCache } from '../api/apiClient';
import { writePageCache } from './pageDataCache';
import { applyWatchlistRowMutation } from './watchlistLocalMutation';

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
