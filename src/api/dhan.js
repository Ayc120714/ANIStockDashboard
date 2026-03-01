import { tradeApiGet, tradeApiPost } from './tradeApiClient';

const withUser = (userId) => `user_id=${encodeURIComponent(String(userId || ''))}`;

export const fetchDhanStatus = async ({ userId } = {}) => {
  return tradeApiGet(`/dhan/status?${withUser(userId)}`);
};

export const connectDhan = async ({ user_id, client_id, pin, totp, access_token, renew_token } = {}) => {
  return tradeApiPost('/dhan/connect', { user_id, client_id, pin, totp, access_token, renew_token });
};

export const disconnectDhan = async ({ user_id }) => {
  return tradeApiPost('/dhan/disconnect', { user_id });
};

export const renewDhanToken = async ({ user_id, client_id, access_token } = {}) => {
  return tradeApiPost('/dhan/renew-token', { user_id, client_id, access_token });
};

export const fetchDhanPositions = async ({ userId } = {}) => {
  if (!userId) return [];
  const data = await tradeApiGet(`/dhan/positions?${withUser(userId)}`);
  return data?.data ?? data;
};

export const fetchDhanHoldings = async ({ userId } = {}) => {
  if (!userId) return [];
  try {
    const data = await tradeApiGet(`/dhan/holdings?${withUser(userId)}`);
    return data?.data ?? data;
  } catch (e) {
    const msg = String(e?.message || '');
    if (msg.includes('404') || msg.toLowerCase().includes('not found')) {
      return [];
    }
    throw e;
  }
};

export const fetchDhanOrders = async ({ userId } = {}) => {
  if (!userId) return [];
  const data = await tradeApiGet(`/dhan/orders?${withUser(userId)}`);
  return data?.data ?? data;
};
