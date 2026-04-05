import { tradeApiGet, tradeApiPost } from './tradeApiClient';

const withUser = (userId) => `user_id=${encodeURIComponent(String(userId || ''))}`;

export const fetchAngeloneStatus = async ({ userId } = {}) => {
  return tradeApiGet(`/angelone/status?${withUser(userId)}`);
};

export const disconnectAngelone = async ({ user_id }) => {
  return tradeApiPost('/angelone/disconnect', { user_id });
};

export const ensureAngeloneSession = async ({ user_id } = {}) => {
  return tradeApiPost('/angelone/ensure-session', { user_id });
};

export const fetchAngelonePositions = async ({ userId } = {}) => {
  if (!userId) return [];
  const data = await tradeApiGet(`/angelone/positions?${withUser(userId)}`);
  return data?.data ?? data;
};

export const fetchAngeloneHoldings = async ({ userId } = {}) => {
  if (!userId) return [];
  const data = await tradeApiGet(`/angelone/holdings?${withUser(userId)}`);
  return data?.data ?? data;
};

export const fetchAngeloneOrders = async ({ userId } = {}) => {
  if (!userId) return [];
  const data = await tradeApiGet(`/angelone/orders?${withUser(userId)}`);
  return data?.data ?? data;
};
