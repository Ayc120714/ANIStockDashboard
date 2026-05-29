import { tradeApiGet, tradeApiGetLive, tradeApiPost } from './tradeApiClient';

const withUser = (userId) => `user_id=${encodeURIComponent(String(userId || ''))}`;

export const fetchSamcoBrokerStatus = async ({ userId } = {}) => {
  return tradeApiGet(`/samco/status?${withUser(userId)}`);
};

export const disconnectSamcoBroker = async ({ user_id }) => {
  return tradeApiPost('/samco/disconnect', { user_id });
};

export const ensureSamcoBrokerSession = async ({ user_id } = {}) => {
  return tradeApiPost('/samco/ensure-session', { user_id });
};

export const fetchSamcoBrokerPositions = async ({ userId } = {}) => {
  if (!userId) return { data: [], message: '' };
  return tradeApiGetLive(`/samco/positions?${withUser(userId)}`);
};

export const fetchSamcoBrokerHoldings = async ({ userId } = {}) => {
  if (!userId) return { data: [], message: '' };
  return tradeApiGetLive(`/samco/holdings?${withUser(userId)}`);
};

export const fetchSamcoBrokerOrders = async ({ userId } = {}) => {
  if (!userId) return { data: [], message: '' };
  return tradeApiGetLive(`/samco/orders?${withUser(userId)}`);
};
