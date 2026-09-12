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

/**
 * Embedded ST/LT chrome (title, add/trade) must sit *outside* FlatList.
 * Putting it in ListHeaderComponent made the stock table height collapse to 0
 * inside the Stocks hub, so LT/ST looked empty even when rows had loaded.
 */
export function shouldRenderWatchlistChromeOutsideList(embedded) {
  return Boolean(embedded);
}

export function watchlistHorizonLabel(horizon) {
  return horizon === 'short_term' ? 'Short Term' : 'Long Term';
}
