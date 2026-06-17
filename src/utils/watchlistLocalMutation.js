/** Optimistic LT/ST watchlist row updates before force-refresh from API. */

export function normalizeWatchlistSymbol(value) {
  return String(value || '').trim().toUpperCase();
}

function collectSymbols(input) {
  if (input == null) return [];
  const list = Array.isArray(input) ? input : [input];
  return list.map((s) => normalizeWatchlistSymbol(s)).filter(Boolean);
}

/**
 * Returns next watchlist rows after add/remove mutation (pure).
 * Regression: UI must show new symbols immediately without hard refresh.
 */
export function applyWatchlistRowMutation(rows, mutation = {}) {
  const removed = new Set(collectSymbols(mutation.removed));
  const added = collectSymbols(mutation.added);
  if (!removed.size && !added.length) {
    return Array.isArray(rows) ? rows : [];
  }

  let next = (Array.isArray(rows) ? rows : []).filter(
    (r) => !removed.has(normalizeWatchlistSymbol(r?.symbol)),
  );
  const existing = new Set(next.map((r) => normalizeWatchlistSymbol(r?.symbol)));
  for (const sym of added) {
    if (!existing.has(sym)) {
      next = [...next, { symbol: sym }];
      existing.add(sym);
    }
  }
  return next;
}
