import {dashboardService} from '@core/api/services/dashboardService';
import {extractApiRows} from '@core/utils/apiPayload';
import {resolveDashboardBrokerHoldings} from '@core/utils/loadBrokerHoldings';
import {dedupeWatchlistBySymbol} from '@core/utils/watchlistPayload';

/**
 * Symbols the user has enabled: broker holdings + short/long watchlist (deduped).
 */
export async function loadUserEnabledSymbols({includeAvailableFallback = true} = {}) {
  const [watchlistRes, holdingsRes] = await Promise.all([
    dashboardService.fetchWatchlist().catch(() => []),
    resolveDashboardBrokerHoldings({preferCache: true}).catch(() => ({rows: []})),
  ]);

  const watchlist = dedupeWatchlistBySymbol(extractApiRows(watchlistRes));
  const holdings = Array.isArray(holdingsRes?.rows) ? holdingsRes.rows : [];
  const bySymbol = new Map();

  holdings.forEach(row => {
    const sym = String(row?.symbol || '').trim().toUpperCase();
    if (!sym) return;
    bySymbol.set(sym, {symbol: sym, sector: '', source: 'holding'});
  });

  watchlist.forEach(row => {
    const sym = String(row?.symbol || '').trim().toUpperCase();
    if (!sym) return;
    const sector = String(row?.sector || row?.subsector || '').trim();
    if (bySymbol.has(sym)) {
      const existing = bySymbol.get(sym);
      if (!existing.sector && sector) existing.sector = sector;
      existing.source = 'holding+watchlist';
      return;
    }
    bySymbol.set(sym, {symbol: sym, sector, source: 'watchlist'});
  });

  if (!bySymbol.size && includeAvailableFallback) {
    const available = await dashboardService.fetchAvailableSymbols().catch(() => []);
    extractApiRows(available).forEach(row => {
      const sym = String(row?.symbol || '').trim().toUpperCase();
      if (!sym || bySymbol.has(sym)) return;
      bySymbol.set(sym, {
        symbol: sym,
        sector: String(row?.sector || row?.subsector || '').trim(),
        source: 'available',
      });
    });
  }

  return [...bySymbol.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
}
