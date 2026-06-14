import {apiGet, apiPost} from '@core/api/apiClient';
import {API_TIMEOUT_MS} from '@core/config/apiTimeouts';
import {extractApiRows} from '@core/utils/apiPayload';
import {mergeApiOpts} from '@core/utils/screenDataFetch';

const T = API_TIMEOUT_MS;

/** Per-broker live API routes (mirror web `src/api/dhan.js`, `angelone.js`, etc.). */
const BROKER_LIVE_PREFIX = {
  dhan: '/dhan',
  angelone: '/angelone',
  zerodha: '/zerodha',
  fyers: '/fyers',
  upstox: '/upstox',
  kotak: '/kotak',
  samco: '/samco',
};

function liveBrokerPath(broker, segment, userId) {
  const b = String(broker || '').toLowerCase();
  const base = BROKER_LIVE_PREFIX[b];
  if (!base) return null;
  const suffix = userId ? `?user_id=${encodeURIComponent(String(userId))}` : '';
  return `${base}/${segment}${suffix}`;
}

async function fetchDhanStatusRow(userId, opts = {}) {
  const suffix = userId ? `?user_id=${encodeURIComponent(String(userId))}` : '';
  const status = await apiGet(`/dhan/status${suffix}`, opts);
  if (!status || typeof status !== 'object') return null;
  const connected = Boolean(status.connected);
  return {
    broker: 'dhan',
    client_id: String(status.client_id || ''),
    is_enabled: Boolean(status.token_stored ?? connected),
    has_session: connected,
    live_enabled: connected,
    daily_session_ok: Boolean(status.daily_session_ok),
    token_stored: Boolean(status.token_stored ?? connected),
    last_auth_at: status.last_auth_at || null,
  };
}

export const brokersService = {
  fetchBrokerOptions: (opts = {}) => apiGet('/brokers/options', mergeApiOpts(opts, T.default)),
  fetchBrokerSetup: async ({userId, timeoutMs} = {}) => {
    const suffix = userId ? `?user_id=${encodeURIComponent(String(userId))}` : '';
    const opts = mergeApiOpts({timeoutMs}, timeoutMs ?? T.screen);
    const fromSetup = await apiGet(`/brokers/setup${suffix}`, opts)
      .then(rows => extractApiRows(rows, ['data']))
      .catch(() => []);
    if (fromSetup.length) return fromSetup;
    try {
      const dhanRow = await fetchDhanStatusRow(userId, opts);
      return dhanRow ? [dhanRow] : [];
    } catch {
      return [];
    }
  },
  saveBrokerSetup: payload => apiPost('/brokers/setup', payload),
  validateBrokerSetup: payload => apiPost('/brokers/validate', payload),
  connectDhan: payload => apiPost('/dhan/connect', payload),
  fetchDhanStatus: (opts = {}) => apiGet('/dhan/status', mergeApiOpts(opts, T.default)),
  disconnectDhan: () => apiPost('/dhan/disconnect', {}),
  fetchBrokerPositions: (broker, opts = {}) => {
    const path = liveBrokerPath(broker, 'positions', opts.userId);
    if (!path) return Promise.resolve([]);
    return apiGet(path, mergeApiOpts(opts, T.screen));
  },
  fetchBrokerOrders: (broker, opts = {}) => {
    const path = liveBrokerPath(broker, 'orders', opts.userId);
    if (!path) return Promise.resolve([]);
    return apiGet(path, mergeApiOpts(opts, T.screen));
  },
  fetchAvailableFunds: async (broker = 'dhan', {userId, timeoutMs} = {}) => {
    const b = encodeURIComponent(String(broker || 'dhan').toLowerCase());
    const uid = userId ? `?user_id=${encodeURIComponent(String(userId))}` : '';
    const candidates = [
      liveBrokerPath(broker, 'fundlimit', userId) || `/dhan/fundlimit${uid}`,
      `/orders/funds?broker=${b}${userId ? `&user_id=${encodeURIComponent(String(userId))}` : ''}`,
    ];
    for (const path of candidates) {
      if (!path) continue;
      try {
        const payload = await apiGet(path, {timeoutMs: timeoutMs ?? T.screen});
        const node = payload?.data && typeof payload.data === 'object' ? payload.data : payload;
        const available = Number(
          node?.available_amount ??
            node?.availableAmount ??
            node?.availabelBalance ??
            node?.availableBalance ??
            node?.withdrawableBalance ??
            node?.sodLimit,
        );
        if (Number.isFinite(available)) {
          return {available_amount: available, source: path, raw: payload};
        }
      } catch (_) {
        /* try next endpoint */
      }
    }
    return null;
  },
};

/** Dhan uses `/dhan/connect`; other brokers validate via `/brokers/validate`. */
export const connectBroker = (broker, payload) => {
  const b = String(broker || '').toLowerCase();
  if (b === 'dhan') {
    return brokersService.connectDhan(payload);
  }
  return brokersService.validateBrokerSetup(payload);
};
