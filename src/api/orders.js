import { apiGet, apiPost } from './apiClient';

const withUser = (userId, query = '') => {
  const sep = query ? '&' : '';
  return `${query}${sep}user_id=${encodeURIComponent(userId)}`;
};

export const placeOrder = (payload) => apiPost('/orders/place', payload);

export const fetchOrders = async ({ userId, status, symbol } = {}) => {
  if (!userId) return [];
  const q = new URLSearchParams();
  q.set('user_id', userId);
  if (status) q.set('status', status);
  if (symbol) q.set('symbol', symbol);
  const data = await apiGet(`/orders?${q.toString()}`);
  return data?.data ?? [];
};

export const fetchOrderById = async ({ userId, orderId }) => {
  const data = await apiGet(`/orders/${orderId}?${withUser(userId)}`);
  return data?.data ?? data;
};

export const cancelOrder = async ({ userId, orderId }) => {
  const data = await apiPost(`/orders/${orderId}/cancel?${withUser(userId)}`, {});
  return data?.data ?? data;
};

export const approveTrailSlToCost = async ({ userId, orderId }) => {
  const data = await apiPost(`/orders/${orderId}/trail-sl-to-cost?${withUser(userId)}`, {});
  return data?.data ?? data;
};

export const updateSuperTargetWithOco = async ({ userId, orderId, targetPrice }) => {
  const data = await apiPost(`/orders/${orderId}/oco-target-update`, {
    user_id: userId,
    target_price: Number(targetPrice),
  });
  return data?.data ?? data;
};

export const fetchPortfolioPositions = async ({ userId }) => {
  if (!userId) return [];
  const data = await apiGet(`/orders/portfolio/positions?${withUser(userId)}`);
  return data?.data ?? [];
};

export const setBrokerExecutionMode = ({ user_id, broker = 'dhan', live_enabled }) =>
  apiPost('/brokers/execution-mode', { user_id, broker, live_enabled: Boolean(live_enabled) });
