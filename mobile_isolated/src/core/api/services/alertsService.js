import {apiGet, apiPost, apiRequest} from '@core/api/apiClient';
import {tradeApiGet} from '@core/api/tradeApiClient';
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

export const alertsService = {
  fetchPriceAlerts: (opts = {}) => apiGet('/price-alerts', {timeoutMs: opts.timeoutMs ?? T.screen}),
  createPriceAlert: payload => apiPost('/price-alerts', payload),
  updatePriceAlert: (id, payload) => apiPost(`/price-alerts/${encodeURIComponent(String(id))}`, payload),
  deletePriceAlert: id => apiRequest(`/price-alerts/${encodeURIComponent(String(id))}`, {method: 'DELETE'}),
  fetchAdvisorAlerts: async (opts = {}) =>
    parseAlertsResponse(await apiGet('/advisor/alerts', {timeoutMs: opts.timeoutMs ?? T.screen})),
  fetchLiveAdvisorAlerts: async ({source, severity, symbol, limit = 80, timeoutMs} = {}) =>
    parseAlertsResponse(
      await apiGet(`/advisor/alerts${toQuery({source, severity, symbol, limit})}`, {
        timeoutMs: timeoutMs ?? T.screen,
      }),
    ),
  createDummyDemoAlert: (opts = {}) =>
    apiPost('/advisor/alerts/dummy-demo', {}, {timeoutMs: opts.timeoutMs ?? T.screen}),
  fetchSpecialAlerts: ({
    symbol,
    limit = 200,
    currentDayOnly = false,
    includeHistory = true,
    timeoutMs,
  } = {}) =>
    apiGet(
      `/advisor/alerts/special${toQuery({symbol, limit, current_day_only: currentDayOnly, include_history: includeHistory})}`,
      {timeoutMs: timeoutMs ?? T.screen},
    ).then(res => extractApiRows(res, ['data', 'alerts'])),
  fetchPriceAlertTriggers: async ({userId, limit = 200, timeoutMs} = {}) => {
    if (!userId) return [];
    const q = toQuery({user_id: userId, limit});
    const data = await tradeApiGet(`/price-alerts/triggers${q}`, {timeoutMs: timeoutMs ?? T.screen});
    return extractApiRows(data, ['data']);
  },
};
