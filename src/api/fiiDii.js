import { apiGet } from './apiClient';

const extractDailyCount = (payload) => (Array.isArray(payload?.daily) ? payload.daily.length : 0);

export async function fetchFiiDiiActivity(minDays = 20) {
  const safeDays = Number.isFinite(minDays) ? Math.max(1, Math.floor(minDays)) : 20;
  const endpointAttempts = [
    `/fii-dii/?days=${safeDays}`,
    `/fii-dii/?limit=${safeDays}`,
    `/fii-dii/?count=${safeDays}`,
    `/fii-dii/?lookback_days=${safeDays}`,
    '/fii-dii/',
  ];

  let bestPayload = null;
  for (const endpoint of endpointAttempts) {
    try {
      // Try commonly used query names because backend variants differ across environments.
      const payload = await apiGet(endpoint);
      if (!bestPayload || extractDailyCount(payload) > extractDailyCount(bestPayload)) {
        bestPayload = payload;
      }
      if (extractDailyCount(payload) >= safeDays) {
        return payload;
      }
    } catch (_) {
      // Continue trying next query variant.
    }
  }

  if (bestPayload) return bestPayload;
  return apiGet('/fii-dii/');
}
