import {apiGet, apiPost, apiRequest} from '@core/api/apiClient';
import {tradeApiGet, tradeApiPost, tradeApiRequest} from '@core/api/tradeApiClient';
import {extractApiRows} from '@core/utils/apiPayload';
import {parseAlertsResponse} from '@core/utils/webParity';
import {API_TIMEOUT_MS} from '@core/config/apiTimeouts';

const T = API_TIMEOUT_MS;

const toQuery = params => {
  const q = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      q.append(k, String(v));
    }
  });
  const raw = q.toString();
  return raw ? `?${raw}` : '';
};

const withUser = (userId, extra = {}) => {
  const q = new URLSearchParams();
  q.set('user_id', String(userId || ''));
  Object.entries(extra).forEach(([k, v]) => {
    if (v == null || v === '') return;
    q.set(k, String(v));
  });
  return q.toString();
};

export const alertsService = {
  /** Match web `priceAlerts.js` — trade API + user_id / list_type. */
  fetchPriceAlerts: async ({userId, listType, activeOnly = true, timeoutMs} = {}) => {
    if (!userId) return [];
    const query = withUser(userId, {list_type: listType, active_only: String(Boolean(activeOnly))});
    const data = await tradeApiGet(`/price-alerts?${query}`, {timeoutMs: timeoutMs ?? T.screen});
    return extractApiRows(data, ['data']);
  },
  createPriceAlert: ({userId, listType, symbol, direction, thresholdPrice, isActive = true, timeoutMs} = {}) =>
    tradeApiPost(
      '/price-alerts',
      {
        user_id: userId,
        list_type: listType,
        symbol,
        direction,
        threshold_price: Number(thresholdPrice),
        is_active: Boolean(isActive),
      },
      {timeoutMs: timeoutMs ?? T.screen},
    ),
  updatePriceAlert: (id, payload) => apiPost(`/price-alerts/${encodeURIComponent(String(id))}`, payload),
  deletePriceAlert: ({userId, alertId, timeoutMs} = {}) => {
    const query = withUser(userId);
    return tradeApiRequest(`/price-alerts/${encodeURIComponent(String(alertId))}?${query}`, {
      method: 'DELETE',
      timeoutMs: timeoutMs ?? T.screen,
    });
  },
  fetchAdvisorAlerts: async (opts = {}) =>
    parseAlertsResponse(await apiGet('/advisor/alerts', {timeoutMs: opts.timeoutMs ?? T.screen, cache: 'no-store'})),
  fetchLiveAdvisorAlerts: async ({source, severity, symbol, limit = 80, timeoutMs} = {}) =>
    parseAlertsResponse(
      await apiGet(`/advisor/alerts${toQuery({source, severity, symbol, limit})}`, {
        timeoutMs: timeoutMs ?? T.screen,
        cache: 'no-store',
      }),
    ),
  markAlertRead: alertId =>
    apiRequest(`/advisor/alerts/${encodeURIComponent(String(alertId))}/read`, {method: 'PUT'}),
  fetchSpecialAlerts: ({
    symbol,
    limit = 200,
    currentDayOnly = false,
    includeHistory = true,
    timeoutMs,
  } = {}) =>
    apiGet(
      `/advisor/alerts/special${toQuery({symbol, limit, current_day_only: currentDayOnly, include_history: includeHistory})}`,
      {timeoutMs: timeoutMs ?? T.screen, cache: 'no-store'},
    ).then(res => extractApiRows(res, ['data', 'alerts'])),
  fetchPriceAlertTriggers: async ({userId, limit = 200, timeoutMs} = {}) => {
    if (!userId) return [];
    const q = toQuery({user_id: userId, limit});
    const data = await tradeApiGet(`/price-alerts/triggers${q}`, {timeoutMs: timeoutMs ?? T.screen});
    return extractApiRows(data, ['data']);
  },
  syncLatestEodWeeklyCrossAlerts: ({limitSymbols = 3000, maxStaleDays = 14, timeoutMs} = {}) =>
    apiPost(
      `/advisor/alerts/sync-latest-eod-weekly-cross${toQuery({
        limit_symbols: limitSymbols,
        max_stale_days: maxStaleDays,
      })}`,
      {},
      {timeoutMs: timeoutMs ?? T.heavy, cache: 'no-store'},
    ),
};
