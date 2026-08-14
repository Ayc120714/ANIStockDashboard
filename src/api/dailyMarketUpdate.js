import { apiGet } from './apiClient';

export async function fetchDailyMarketUpdate(opts = {}) {
  const params = new URLSearchParams();
  if (opts.volumeLimit != null) params.set('volume_limit', String(opts.volumeLimit));
  if (opts.sectorTopN != null) params.set('sector_top_n', String(opts.sectorTopN));
  if (opts.signalSymbolLimit != null) params.set('signal_symbol_limit', String(opts.signalSymbolLimit));
  const qs = params.toString();
  return apiGet(`/daily-market-update${qs ? `?${qs}` : ''}`);
}
