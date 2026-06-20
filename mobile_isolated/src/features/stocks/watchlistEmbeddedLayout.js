/**
 * Embedded LT/ST watchlist tabs live inside Stocks → Overview chips.
 * Bulky add/trade panels are collapsed by default so the watchlist table stays visible.
 */
export function initialWatchlistPanelState(embedded) {
  if (embedded) {
    return {addExpanded: false, tradeExpanded: false};
  }
  return {addExpanded: true, tradeExpanded: true};
}

export function watchlistHorizonLabel(horizon) {
  return horizon === 'short_term' ? 'Short Term' : 'Long Term';
}
