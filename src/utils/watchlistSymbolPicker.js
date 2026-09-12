/** Cap the ST/LT add-stock dropdown so opening it does not try to render the full universe. */
export const WATCHLIST_ADD_MIN_QUERY_CHARS = 1;
export const WATCHLIST_ADD_MAX_RESULTS = 50;

function optionText(opt) {
  if (typeof opt === 'string') {
    return {symbol: opt, sector: '', subsector: '', isIpo: false};
  }
  return {
    symbol: String(opt?.symbol || ''),
    sector: String(opt?.sector || ''),
    subsector: String(opt?.subsector || ''),
    isIpo: isIpoPickerOption(opt),
  };
}

/** Current IPO issues (and names tagged from /available-symbols). */
export function isIpoPickerOption(opt) {
  if (!opt || typeof opt === 'string') return false;
  if (Boolean(opt.is_ipo) || Boolean(opt.isIpo)) return true;
  return String(opt.sector || '').trim().toUpperCase() === 'IPO';
}

export function ipoWatchlistAddOptions(opts) {
  const list = Array.isArray(opts) ? opts : [];
  return list.filter((opt) => isIpoPickerOption(opt));
}

/**
 * Filter add-stock Autocomplete options on Short Term / Long Term pages.
 * Empty query used to return every master symbol (~1200), which froze or hid the list.
 * Opening the box now lists current IPO stocks instead of an empty list.
 */
export function filterWatchlistAddOptions(opts, inputValue, {
  minChars = WATCHLIST_ADD_MIN_QUERY_CHARS,
  maxResults = WATCHLIST_ADD_MAX_RESULTS,
} = {}) {
  const list = Array.isArray(opts) ? opts : [];
  const q = String(inputValue || '').trim().toLowerCase();
  if (q.length < minChars) return ipoWatchlistAddOptions(list);
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
