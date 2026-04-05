import { tradeApiGet, tradeApiPost } from './tradeApiClient';

const withUser = (userId) => `user_id=${encodeURIComponent(String(userId || ''))}`;

export const fetchUpstoxBrokerStatus = async ({ userId } = {}) => {
  return tradeApiGet(`/upstox/status?${withUser(userId)}`);
};

export const disconnectUpstoxBroker = async ({ user_id }) => {
  return tradeApiPost('/upstox/disconnect', { user_id });
};

export const ensureUpstoxBrokerSession = async ({ user_id } = {}) => {
  return tradeApiPost('/upstox/ensure-session', { user_id });
};

export const fetchUpstoxBrokerPositions = async ({ userId } = {}) => {
  if (!userId) return { data: [], message: '' };
  return tradeApiGet(`/upstox/positions?${withUser(userId)}`);
};

export const fetchUpstoxBrokerHoldings = async ({ userId } = {}) => {
  if (!userId) return { data: [], message: '' };
  return tradeApiGet(`/upstox/holdings?${withUser(userId)}`);
};

export const fetchUpstoxBrokerOrders = async ({ userId } = {}) => {
  if (!userId) return { data: [], message: '' };
  return tradeApiGet(`/upstox/orders?${withUser(userId)}`);
};
