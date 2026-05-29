import { tradeApiGet, tradeApiGetLive, tradeApiPost } from './tradeApiClient';

const withUser = (userId) => `user_id=${encodeURIComponent(String(userId || ''))}`;

export const fetchKotakBrokerStatus = async ({ userId } = {}) => {
  return tradeApiGet(`/kotak/status?${withUser(userId)}`);
};

export const disconnectKotakBroker = async ({ user_id }) => {
  return tradeApiPost('/kotak/disconnect', { user_id });
};

export const ensureKotakBrokerSession = async ({ user_id } = {}) => {
  return tradeApiPost('/kotak/ensure-session', { user_id });
};

export const fetchKotakBrokerPositions = async ({ userId } = {}) => {
  if (!userId) return { data: [], message: '' };
  return tradeApiGetLive(`/kotak/positions?${withUser(userId)}`);
};

export const fetchKotakBrokerHoldings = async ({ userId } = {}) => {
  if (!userId) return { data: [], message: '' };
  return tradeApiGetLive(`/kotak/holdings?${withUser(userId)}`);
};

export const fetchKotakBrokerOrders = async ({ userId } = {}) => {
  if (!userId) return { data: [], message: '' };
  return tradeApiGetLive(`/kotak/orders?${withUser(userId)}`);
};
