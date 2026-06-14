const isFiniteNumber = v => typeof v === 'number' && Number.isFinite(v);

/** One row per symbol — watchlist API can return the same ticker in short + long lists. */
export function dedupeWatchlistBySymbol(rows = []) {
  const bySymbol = new Map();
  (rows || []).forEach(row => {
    const symbol = String(row?.symbol || '')
      .trim()
      .toUpperCase();
    if (!symbol) return;
    const existing = bySymbol.get(symbol);
    if (!existing) {
      bySymbol.set(symbol, row);
      return;
    }
    const preferNew =
      (row.list_type === 'short_term' && existing.list_type !== 'short_term')
      || (isFiniteNumber(row.day1d) && !isFiniteNumber(existing.day1d));
    if (preferNew) bySymbol.set(symbol, row);
  });
  return Array.from(bySymbol.values());
}
