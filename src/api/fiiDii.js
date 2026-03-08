import { apiGet } from './apiClient';

const extractDailyCount = (payload) => (Array.isArray(payload?.daily) ? payload.daily.length : 0);
const MAX_LOOKBACK_MONTHS = 6;

const parseDailyDate = (value) => {
  if (!value || typeof value !== 'string') return null;
  const parts = value.split('-');
  if (parts.length !== 3) return null;
  const [dd, mon, yyyy] = parts;
  const monthMap = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  const monthIdx = monthMap[(mon || '').slice(0, 3).toLowerCase()];
  const day = Number(dd);
  const year = Number(yyyy);
  if (monthIdx == null || !Number.isFinite(day) || !Number.isFinite(year)) return null;
  const dt = new Date(year, monthIdx, day);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
};

const formatMonthYear = (dateObj) => ({
  month: dateObj.getMonth() + 1,
  year: dateObj.getFullYear(),
});

const prevMonth = ({ month, year }) => (
  month <= 1
    ? { month: 12, year: year - 1 }
    : { month: month - 1, year }
);

const mergeDailyRows = (baseRows, extraRows, limit) => {
  const merged = new Map();
  [...(baseRows || []), ...(extraRows || [])].forEach((row) => {
    const key = row?.date;
    if (!key || merged.has(key)) return;
    merged.set(key, row);
  });

  return [...merged.values()]
    .sort((a, b) => {
      const db = parseDailyDate(b?.date);
      const da = parseDailyDate(a?.date);
      return (db?.getTime() || 0) - (da?.getTime() || 0);
    })
    .slice(0, limit);
};

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

  const fallbackPayload = bestPayload || await apiGet('/fii-dii/');
  if (extractDailyCount(fallbackPayload) >= safeDays) return fallbackPayload;

  let mergedDaily = Array.isArray(fallbackPayload?.daily) ? [...fallbackPayload.daily] : [];
  const firstDate = parseDailyDate(mergedDaily[0]?.date) || new Date();
  let cursor = prevMonth(formatMonthYear(firstDate));

  for (let i = 0; i < MAX_LOOKBACK_MONTHS && mergedDaily.length < safeDays; i += 1) {
    try {
      const monthPayload = await apiGet(`/fii-dii/?month=${cursor.month}&year=${cursor.year}`);
      mergedDaily = mergeDailyRows(mergedDaily, monthPayload?.daily, safeDays);
    } catch (_) {
      // Ignore and continue to older month.
    }
    cursor = prevMonth(cursor);
  }

  return {
    ...(fallbackPayload || {}),
    daily: mergedDaily.slice(0, safeDays),
  };
}
