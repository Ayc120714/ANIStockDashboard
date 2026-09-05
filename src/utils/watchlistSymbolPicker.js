/** Cap the ST/LT add-stock dropdown so opening it does not try to render the full universe. */
export const WATCHLIST_ADD_MIN_QUERY_CHARS = 1;
export const WATCHLIST_ADD_MAX_RESULTS = 50;

function optionText(opt) {
  if (typeof opt === 'string') {
    return {symbol: opt, sector: '', subsector: ''};
  }
  return {
    symbol: String(opt?.symbol || ''),
    sector: String(opt?.sector || ''),
    subsector: String(opt?.subsector || ''),
  };
}

/**
 * Filter add-stock Autocomplete options on Short Term / Long Term pages.
 * Empty query used to return every master symbol (~1200), which froze or hid the list.
 */
export function filterWatchlistAddOptions(opts, inputValue, {
  minChars = WATCHLIST_ADD_MIN_QUERY_CHARS,
  maxResults = WATCHLIST_ADD_MAX_RESULTS,
} = {}) {
  const list = Array.isArray(opts) ? opts : [];
  const q = String(inputValue || '').trim().toLowerCase();
  if (q.length < minChars) return [];
  const matched = [];
  for (const opt of list) {
    const {symbol, sector, subsector} = optionText(opt);
    if (
      symbol.toLowerCase().includes(q)
      || sector.toLowerCase().includes(q)
      || subsector.toLowerCase().includes(q)
    ) {
      matched.push(opt);
      if (matched.length >= maxResults) break;
    }
  }
  return matched;
}
