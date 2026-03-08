import { apiGet } from './apiClient';

export async function fetchFiiDiiActivity(minDays = 20) {
  const safeDays = Number.isFinite(minDays) ? Math.max(1, Math.floor(minDays)) : 20;
  return apiGet(`/fii-dii/?days=${safeDays}`);
}
