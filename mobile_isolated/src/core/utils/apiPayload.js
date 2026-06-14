/** Normalize list payloads from API responses ({ data: [] } | [] | nested keys). */
export function extractApiRows(payload, keys = []) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

/** `/api/watchlist` returns `{ count, data: [] }` — same keys as the web client. */
export function parseWatchlistRows(payload) {
  return extractApiRows(payload, ['data', 'watchlist', 'rows']);
}

/** `/api/watchlist/signals` and similar signal list endpoints. */
export function parseSignalRows(payload) {
  return extractApiRows(payload, ['signals', 'rows', 'data']);
}
