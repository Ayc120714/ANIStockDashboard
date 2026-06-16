/**
 * Pure helpers for Markets overview tabs (market / sector / subsector).
 * Keeps focus-refresh and cache-usability logic unit-testable.
 */

export function marketsOutlookListForTab(tab, {rows = [], sectorRows = [], subRows = []} = {}) {
  if (tab === 'market') return rows;
  if (tab === 'sector') return sectorRows;
  return subRows;
}

/** Silent background refresh when the screen already shows cached rows or FII/DII. */
export function shouldMarketsFocusReloadSilent({listLength = 0, fii = null} = {}) {
  return listLength > 0 || fii != null;
}

export function marketsOutlookPayloadUsable(tab, data) {
  if (!data || typeof data !== 'object') return false;
  if (tab === 'market') return (data.rows?.length > 0) || data.fii != null;
  if (tab === 'sector') return data.sectorRows?.length > 0;
  return data.subRows?.length > 0;
}

/**
 * On screen focus: refetch only when page cache is stale.
 * Returns whether a reload ran and whether it was silent.
 */
export async function refreshMarketsOutlookOnFocus({
  cacheKey,
  listLength = 0,
  fii = null,
  shouldRefreshPageCache,
  load,
}) {
  const stale = await shouldRefreshPageCache(cacheKey);
  if (!stale) {
    return {refreshed: false, silent: false};
  }
  const silent = shouldMarketsFocusReloadSilent({listLength, fii});
  await load({silent});
  return {refreshed: true, silent};
}
