import {extractApiRows} from '@core/utils/apiPayload';
import {parseStockListResponse} from '@core/utils/stockListPayload';

export {extractApiRows};

export function parseWatchlistResponse(payload) {
  return extractApiRows(payload, ['data', 'watchlist', 'rows']);
}

/** `/api/watchlist/signals` → row array. */
export function parseWatchlistSignalsResponse(payload) {
  return extractApiRows(payload, ['signals', 'rows', 'data']);
}

/** `/api/watchlist/order-blocks` → row array. */
export function parseOrderBlocksResponse(payload) {
  return extractApiRows(payload, ['order_blocks', 'rows', 'data']);
}

/** `/api/watchlist/weekly-indicators` → row array. */
export function parseWeeklyIndicatorsResponse(payload) {
  return extractApiRows(payload, ['weekly_indicators', 'weekly_entries', 'rows', 'data']);
}

/** `/api/advisor/signals/weekly-entries` → row array (web: advisor.js). */
export function parseWeeklyEntriesResponse(payload) {
  return extractApiRows(payload, ['data', 'weekly_entries']);
}

/** `/api/advisor/ratings` → row array. */
export function parseRatingsResponse(payload) {
  return extractApiRows(payload, ['data', 'ratings']);
}

/** `/api/advisor/alerts` → row array. */
export function parseAlertsResponse(payload) {
  return extractApiRows(payload, ['data', 'alerts']);
}

/** `/api/advisor/signals/latest` and most advisor list endpoints. */
export function parseAdvisorListResponse(payload) {
  return extractApiRows(payload, ['data']);
}

/** `/api/stocks/*` list endpoints (price-shockers, trending, volume, relative-performance). */
export function parseStocksListResponse(payload) {
  if (Array.isArray(payload)) return payload;
  return parseStockListResponse(payload);
}

/** `/api/ipo` → row array. */
export function parseIpoResponse(payload) {
  return extractApiRows(payload, ['data', 'ipos']);
}

/** `/api/stocks/screen-dates` → `string[]`. */
export function parseScreenDatesResponse(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.dates)) return payload.dates;
  return [];
}

/** `/api/stocks/weekly-picks` — keep object shape (bullish/bearish arrays). */
export function parseWeeklyPicksResponse(payload) {
  if (!payload || typeof payload !== 'object') {
    return {bullish: [], bearish: [], pick_date: null};
  }
  return {
    bullish: Array.isArray(payload.bullish) ? payload.bullish : [],
    bearish: Array.isArray(payload.bearish) ? payload.bearish : [],
    fno_bullish: Array.isArray(payload.fno_bullish) ? payload.fno_bullish : [],
    fno_bearish: Array.isArray(payload.fno_bearish) ? payload.fno_bearish : [],
    pick_date: payload.pick_date ?? payload.pickDate ?? null,
  };
}

/** `/api/watchlist/available-symbols` → `{ symbol, sector, subsector }[]`. */
export function parseAvailableSymbolsResponse(payload) {
  return extractApiRows(payload, ['data', 'symbols']);
}

/** Ensure value is a stock row array whether service returned raw or parsed. */
export function ensureStockRows(value) {
  return parseStocksListResponse(value);
}
