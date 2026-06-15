/** Which dashboard sections should be refetched (without clearing the whole cache). */
export function dashboardSectionsToRefresh(cached) {
  const payload = cached || {};
  return {
    indices: !payload.indices,
    movers: !Array.isArray(payload.gainers) || !Array.isArray(payload.losers),
    watchlist: !Array.isArray(payload.watchlist),
    signals: !Array.isArray(payload.signals),
    weekly: !Array.isArray(payload.weeklyData),
    extras:
      !Array.isArray(payload.alerts)
      || !Array.isArray(payload.ratings)
      || !Array.isArray(payload.trendingStocks),
    optional: !Array.isArray(payload.sectors) || !Array.isArray(payload.obData),
  };
}

/** During NSE session, refresh volatile dashboard sections on each poll (incl. alerts). */
export function applyLiveSessionRefreshPolicy(need, liveSession) {
  if (!need || !liveSession) return need;
  need.indices = true;
  need.movers = true;
  need.watchlist = true;
  need.signals = true;
  need.extras = true;
  return need;
}
