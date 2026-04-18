import { tradeApiGet, tradeApiPost } from './tradeApiClient';

const withUser = (userId) => `user_id=${encodeURIComponent(String(userId || ''))}`;

export const fetchFyersBrokerStatus = async ({ userId } = {}) => {
  return tradeApiGet(`/fyers/status?${withUser(userId)}`);
};

export const disconnectFyersBroker = async ({ user_id }) => {
  return tradeApiPost('/fyers/disconnect', { user_id });
};

export const ensureFyersBrokerSession = async ({ user_id } = {}) => {
  return tradeApiPost('/fyers/ensure-session', { user_id });
};

export const fetchFyersBrokerPositions = async ({ userId } = {}) => {
  if (!userId) return { data: [], message: '' };
  return tradeApiGet(`/fyers/positions?${withUser(userId)}`);
};

export const fetchFyersBrokerHoldings = async ({ userId } = {}) => {
  if (!userId) return { data: [], message: '' };
  return tradeApiGet(`/fyers/holdings?${withUser(userId)}`);
};

export const fetchFyersBrokerOrders = async ({ userId } = {}) => {
  if (!userId) return { data: [], message: '' };
  return tradeApiGet(`/fyers/orders?${withUser(userId)}`);
};
