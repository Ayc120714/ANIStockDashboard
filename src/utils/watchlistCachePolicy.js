/** LT/ST watchlist cache must hold master-derived fields, not symbol-only optimistic stubs. */

const MARKET_FIELDS = [
  'price',
  'day1d',
  'market_cap',
  'composite_score',
  'signal_score',
  'rsi',
  'buy_sell_tier',
  'entry_price',
  'stop_loss',
  'target_short_term',
  'target_long_term',
  'volume_ratio',
  'recommendation',
];

function hasPresentValue(value) {
  return value !== null && value !== undefined && value !== '';
}

/** True when a row has at least one field populated from master data (sector, rating, or signal). */
export function isWatchlistRowEnriched(row) {
  if (!row || !hasPresentValue(row.symbol)) return false;
  return MARKET_FIELDS.some((key) => hasPresentValue(row[key]));
}

/**
 * Watchlist page cache is usable only when every symbol row is enriched.
 * Regression: optimistic add wrote `{ symbol }` only; closed-market skip then froze dashes.
 */
export function watchlistPayloadHasUsableMarketData(payload) {
  const wl = payload?.watchlist;
  if (!Array.isArray(wl) || wl.length === 0) return false;
  return wl.every(isWatchlistRowEnriched);
}
