import {apiGet, apiPost} from '@core/api/apiClient';
import {extractApiRows} from '@core/utils/apiPayload';

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
  fetchBrokerOptions: () => apiGet('/brokers/options'),
  fetchBrokerSetup: async ({userId, timeoutMs} = {}) => {
    const suffix = userId ? `?user_id=${encodeURIComponent(String(userId))}` : '';
    const opts = timeoutMs ? {timeoutMs} : {};
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
  },  saveBrokerSetup: payload => apiPost('/brokers/setup', payload),
  validateBrokerSetup: payload => apiPost('/brokers/validate', payload),
  connectDhan: payload => apiPost('/brokers/dhan/connect', payload),
  fetchDhanStatus: () => apiGet('/brokers/dhan/status'),
  disconnectDhan: () => apiPost('/brokers/dhan/disconnect', {}),
  connectAngelOne: payload => apiPost('/brokers/angelone/connect', payload),
  connectZerodha: payload => apiPost('/brokers/zerodha/connect', payload),
  connectFyers: payload => apiPost('/brokers/fyers/connect', payload),
  connectUpstox: payload => apiPost('/brokers/upstox/connect', payload),
  connectKotak: payload => apiPost('/brokers/kotak/connect', payload),
  connectSamco: payload => apiPost('/brokers/samco/connect', payload),
  fetchBrokerPositions: broker => apiGet(`/brokers/${encodeURIComponent(String(broker))}/positions`),
  fetchBrokerOrders: broker => apiGet(`/brokers/${encodeURIComponent(String(broker))}/orders`),
  fetchAvailableFunds: async (broker = 'dhan', {userId} = {}) => {
    const b = encodeURIComponent(String(broker || 'dhan').toLowerCase());
    const uid = userId ? `?user_id=${encodeURIComponent(String(userId))}` : '';
    const candidates = [
      `/brokers/${b}/funds${uid}`,
      `/orders/funds?broker=${b}${userId ? `&user_id=${encodeURIComponent(String(userId))}` : ''}`,
      `/dhan/fundlimit${uid}`,
    ];
    for (const path of candidates) {
      try {
        const payload = await apiGet(path);
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

const CONNECT_BY_BROKER = {
  dhan: payload => brokersService.connectDhan(payload),
  angelone: payload => brokersService.connectAngelOne(payload),
  zerodha: payload => brokersService.connectZerodha(payload),
  fyers: payload => brokersService.connectFyers(payload),
  upstox: payload => brokersService.connectUpstox(payload),
  kotak: payload => brokersService.connectKotak(payload),
  samco: payload => brokersService.connectSamco(payload),
};

export const connectBroker = (broker, payload) => {
  const fn = CONNECT_BY_BROKER[String(broker || '').toLowerCase()];
  if (!fn) {
    return brokersService.validateBrokerSetup(payload);
  }
  return fn(payload);
};
