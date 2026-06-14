import {tradeApiGet} from '@core/api/tradeApiClient';
import {API_TIMEOUT_MS} from '@core/config/apiTimeouts';

const withUser = userId => `user_id=${encodeURIComponent(String(userId || ''))}`;

const REST_BROKERS = ['samco', 'upstox', 'kotak', 'fyers', 'zerodha'];

async function fetchBrokerSlice(broker, slice, userId, timeoutMs = API_TIMEOUT_MS.screen) {
  if (!userId) return [];
  const b = String(broker || '').toLowerCase();
  try {
    const data = await tradeApiGet(`/${b}/${slice}?${withUser(userId)}`, {timeoutMs});
    return data?.data ?? data;
  } catch (e) {
    const msg = String(e?.message || '').toLowerCase();
    if (msg.includes('404') || msg.includes('not found')) return [];
    throw e;
  }
}

export const brokerPortfolioService = {
  fetchDhanPositions: ({userId} = {}) => fetchBrokerSlice('dhan', 'positions', userId),
  fetchDhanHoldings: ({userId} = {}) => fetchBrokerSlice('dhan', 'holdings', userId),
  fetchDhanOrders: ({userId} = {}) => fetchBrokerSlice('dhan', 'orders', userId),
  fetchAngelonePositions: ({userId} = {}) => fetchBrokerSlice('angelone', 'positions', userId),
  fetchAngeloneHoldings: ({userId} = {}) => fetchBrokerSlice('angelone', 'holdings', userId),
  fetchAngeloneOrders: ({userId} = {}) => fetchBrokerSlice('angelone', 'orders', userId),
  loadRestBrokerPortfolioSlices: (broker, userId) => {
    const b = String(broker || '').toLowerCase();
    if (!REST_BROKERS.includes(b)) return null;
    return Promise.allSettled([
      fetchBrokerSlice(b, 'positions', userId),
      fetchBrokerSlice(b, 'holdings', userId),
      fetchBrokerSlice(b, 'orders', userId),
    ]);
  },
};
