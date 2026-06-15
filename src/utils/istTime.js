/** Parse API timestamps (naive IST, ISO with offset, etc.) for IST display. */

export const NOTIFICATION_TIMEZONE = 'Asia/Kolkata';
export const IST_OFFSET = '+05:30';

/** Naive alert timestamps from the API are NSE wall clock (IST), not UTC. */
export function parseNaiveIstMs(value) {
  if (value == null || value === '') return null;
  const s = String(value).trim();
  const isoLike = s.includes('T') ? s : s.replace(/^(\d{4}-\d{2}-\d{2})\s+/, '$1T');
  const hasZone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(isoLike);
  const normalized = hasZone ? isoLike : `${isoLike}${IST_OFFSET}`;
  const ms = Date.parse(normalized);
  return Number.isFinite(ms) ? ms : null;
}

/** @deprecated Use parseNaiveIstMs — kept for non-notification callers. */
export function parseNaiveUtcMs(value) {
  return parseNaiveIstMs(value);
}

/** Format a timestamp as wall-clock time in Asia/Kolkata (IST). */
export function formatDateTimeIST(value, options = {}) {
  const ms = parseNaiveIstMs(value);
  if (ms == null) return '';
  const {
    month = 'short',
    day = 'numeric',
    hour = '2-digit',
    minute = '2-digit',
    second,
    hour12 = false,
    suffix = ' IST',
  } = options;
  try {
    const fmt = {
      timeZone: NOTIFICATION_TIMEZONE,
      month,
      day,
      hour,
      minute,
      hour12,
    };
    if (second) fmt.second = second;
    const formatted = new Intl.DateTimeFormat('en-IN', fmt).format(new Date(ms));
    return suffix ? `${formatted}${suffix}` : formatted;
  } catch (_) {
    return String(value);
  }
}

/** Format ``Date`` or ms as IST time only (e.g. notification inbox sync line). */
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
