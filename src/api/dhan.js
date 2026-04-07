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

const firstNonEmptyStr = (...vals) => {
  for (const v of vals) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return '';
};

/**
 * POST body must include api_key / api_secret as real strings when set.
 * JSON.stringify drops keys whose value is `undefined`, which made the backend think secrets were missing.
 */
export const connectDhan = async (params = {}) => {
  const p = params || {};
  const clientId = firstNonEmptyStr(p.client_id, p.clientId, p.dhanClientId);
  const apiKey = firstNonEmptyStr(p.api_key, p.app_id, p.appId, p.apiKey);
  const apiSecret = firstNonEmptyStr(p.api_secret, p.app_secret, p.appSecret);
  try {
    return await tradeApiPost('/dhan/connect', {
      user_id: p.user_id ?? null,
      client_id: clientId,
      pin: p.pin != null ? String(p.pin) : '',
      totp: p.totp != null ? String(p.totp) : '',
      access_token: p.access_token != null ? String(p.access_token) : '',
      renew_token: Boolean(p.renew_token),
      api_key: apiKey,
      api_secret: apiSecret,
      token_id: p.token_id != null ? String(p.token_id) : '',
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
