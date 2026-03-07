import { tradeApiGet, tradeApiPost } from './tradeApiClient';

const withUser = (userId) => `user_id=${encodeURIComponent(String(userId || ''))}`;
const DHAN_DAILY_CONSENT_LIMIT = 25;

const normalizeDhanError = (error) => {
  const raw = String(error?.message || '').trim();
  const msgUpper = raw.toUpperCase();
  const isConsentLimit =
    msgUpper.includes('CONSENT_LIMIT_EXCEED')
    || msgUpper.includes('CONSENT LIMIT')
    || msgUpper.includes('CONSENT_LIMIT');
  if (!isConsentLimit) return error;
  const normalized = new Error(
    `Dhan allows maximum ${DHAN_DAILY_CONSENT_LIMIT} consent logins per day. Limit reached for today; please retry tomorrow.`
  );
  normalized.cause = error;
  return normalized;
};

export const fetchDhanStatus = async ({ userId } = {}) => {
  return tradeApiGet(`/dhan/status?${withUser(userId)}`);
};

export const connectDhan = async ({
  user_id,
  client_id,
  pin,
  totp,
  access_token,
  renew_token,
  api_key,
  api_secret,
  token_id,
} = {}) => {
  try {
    return await tradeApiPost('/dhan/connect', {
      user_id,
      client_id,
      pin,
      totp,
      access_token,
      renew_token,
      api_key,
      api_secret,
      token_id,
    });
  } catch (e) {
    throw normalizeDhanError(e);
  }
};

export const disconnectDhan = async ({ user_id }) => {
  return tradeApiPost('/dhan/disconnect', { user_id });
};

export const ensureDhanSession = async ({ user_id } = {}) => {
  return tradeApiPost('/dhan/ensure-session', { user_id });
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
