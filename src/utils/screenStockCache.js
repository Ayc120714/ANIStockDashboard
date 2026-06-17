/** Legacy sessionStorage keys that cached pre-formatted CHG% strings (wrong after backend fix). */
export const LEGACY_FORMATTED_SCREEN_CACHE_PREFIXES = [
  'trendingStocksData_v2_',
  'relativePerformanceData_v2_',
  'priceShockersData_v3_',
  'volumeShockersData_v4_',
  'dashboard_overview_cache_v4',
  'dashboard_overview_cache_v5',
];

let legacyPurged = false;

export function purgeLegacyFormattedScreenCaches() {
  if (typeof sessionStorage === 'undefined') return;
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
      const k = sessionStorage.key(i);
      if (!k) continue;
      if (LEGACY_FORMATTED_SCREEN_CACHE_PREFIXES.some((p) => k.startsWith(p) || k === p)) {
        sessionStorage.removeItem(k);
      }
    }
  } catch (_) {
    /* ignore */
  }
}

export function ensureLegacyFormattedScreenCachesPurged() {
  if (legacyPurged) return;
  legacyPurged = true;
  purgeLegacyFormattedScreenCaches();
}
