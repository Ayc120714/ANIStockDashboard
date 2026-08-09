import { apiGet, apiPost } from './apiClient';

export async function fetchFiiDiiActivity(minDays = 20) {
  const safeDays = Number.isFinite(minDays) ? Math.max(1, Math.floor(minDays)) : 20;
  return apiGet(`/fii-dii/?days=${safeDays}`);
}

export async function fetchFiiSectorFlows({ sort = 'fortnight_change', limit = 50, refresh = false } = {}) {
  const params = new URLSearchParams({
    sort: String(sort),
    limit: String(limit),
  });
  if (refresh) params.set('refresh', 'true');
  return apiGet(`/fii-dii/sectors?${params.toString()}`);
}

export async function fetchFiiSectorStocks(sector, { limit = 25 } = {}) {
  const name = encodeURIComponent(String(sector || '').trim());
  return apiGet(`/fii-dii/sectors/${name}/stocks?limit=${encodeURIComponent(String(limit))}`);
}

export async function refreshFiiSectorFlows() {
  return apiPost('/fii-dii/sectors/refresh');
}
