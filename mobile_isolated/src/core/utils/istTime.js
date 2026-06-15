/** IST helpers for mobile (parity with web src/utils/istTime.js). */

export const NOTIFICATION_TIMEZONE = 'Asia/Kolkata';
export const IST_OFFSET = '+05:30';

export function parseNaiveIstMs(value) {
  if (value == null || value === '') return null;
  const s = String(value).trim();
  const isoLike = s.includes('T') ? s : s.replace(/^(\d{4}-\d{2}-\d{2})\s+/, '$1T');
  const hasZone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(isoLike);
  const normalized = hasZone ? isoLike : `${isoLike}${IST_OFFSET}`;
  const ms = Date.parse(normalized);
  return Number.isFinite(ms) ? ms : null;
}

export function formatNowTimeIST(date = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: NOTIFICATION_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    return date.toLocaleTimeString();
  }
}
