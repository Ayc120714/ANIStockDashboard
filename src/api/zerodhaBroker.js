import { tradeApiGet, tradeApiGetLive, tradeApiPost } from './tradeApiClient';

const withUser = (userId) => `user_id=${encodeURIComponent(String(userId || ''))}`;

export const fetchZerodhaBrokerStatus = async ({ userId } = {}) => {
  return tradeApiGet(`/zerodha/status?${withUser(userId)}`);
};

export const disconnectZerodhaBroker = async ({ user_id }) => {
  return tradeApiPost('/zerodha/disconnect', { user_id });
};

export const ensureZerodhaBrokerSession = async ({ user_id } = {}) => {
  return tradeApiPost('/zerodha/ensure-session', { user_id });
};

export const fetchZerodhaBrokerPositions = async ({ userId } = {}) => {
  if (!userId) return { data: [], message: '' };
  return tradeApiGetLive(`/zerodha/positions?${withUser(userId)}`);
};

export const fetchZerodhaBrokerHoldings = async ({ userId } = {}) => {
  if (!userId) return { data: [], message: '' };
  return tradeApiGetLive(`/zerodha/holdings?${withUser(userId)}`);
};

export const fetchZerodhaBrokerOrders = async ({ userId } = {}) => {
  if (!userId) return { data: [], message: '' };
  return tradeApiGetLive(`/zerodha/orders?${withUser(userId)}`);
};
