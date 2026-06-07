/** Parse API timestamps (naive UTC, ISO with offset, etc.) for IST display. */
export function parseNaiveUtcMs(value) {
  if (value == null || value === '') return null;
  const s = String(value).trim();
  const isoLike = s.includes('T') ? s : s.replace(/^(\d{4}-\d{2}-\d{2})\s+/, '$1T');
  const hasZone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(isoLike);
  const normalized = hasZone ? isoLike : `${isoLike}Z`;
  const ms = Date.parse(normalized);
  return Number.isFinite(ms) ? ms : null;
}

/** Format a timestamp as wall-clock time in Asia/Kolkata (IST). */
export function formatDateTimeIST(value, options = {}) {
  const ms = parseNaiveUtcMs(value);
  if (ms == null) return '';
  const {
    month = 'short',
    day = 'numeric',
    hour = '2-digit',
    minute = '2-digit',
    hour12 = true,
    suffix = ' IST',
  } = options;
  try {
    const formatted = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      month,
      day,
      hour,
      minute,
      hour12,
    }).format(new Date(ms));
    return suffix ? `${formatted}${suffix}` : formatted;
  } catch (_) {
    return String(value);
  }
}
