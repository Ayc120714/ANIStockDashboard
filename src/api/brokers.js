import { tradeApiGet, tradeApiPost } from './tradeApiClient';

/** True when this broker row can load live portfolio today (matches Dashboard / Profile semantics). */
export const brokerRowHasLiveTradingSession = (row) => {
  if (!row) return false;
  const b = String(row.broker || '').toLowerCase();
  if (b === 'dhan') return Boolean(row.has_session);
  return Boolean(row.live_enabled ?? row.has_session);
};

export const hasAnyBrokerLiveSession = (rows) =>
  Array.isArray(rows) && rows.some((r) => brokerRowHasLiveTradingSession(r));

/**
 * Whether we should run the Dhan OAuth/consent callback flow (env + user intent).
 * Avoids calling Dhan connect when the user only uses Angel / Samco / Upstox.
 */
export const userMayNeedDhanConsentFlow = (rows, draft = {}) => {
  const d = String(draft?.client_id || '').trim();
  const k = String(draft?.credentials?.api_key || draft?.api_key || '').trim();
  const s = String(draft?.credentials?.api_secret || draft?.api_secret || '').trim();
  if (d || k || s) return true;
  const arr = Array.isArray(rows) ? rows : [];
  const dhanRow = arr.find((r) => String(r.broker || '').toLowerCase() === 'dhan');
  if (!dhanRow) return false;
  return Boolean(dhanRow.token_stored || dhanRow.is_enabled);
};

export const fetchBrokerOptions = () => tradeApiGet('/brokers/options');

export const fetchBrokerSetup = async ({ userId } = {}) => {
  const suffix = userId ? `?user_id=${encodeURIComponent(String(userId))}` : '';
  try {
    const rows = await tradeApiGet(`/brokers/setup${suffix}`);
    if (Array.isArray(rows) && rows.length) return rows;
  } catch (_) {
    /* fallback if older backend without /brokers/setup */
  }
  const status = await tradeApiGet(`/dhan/status${suffix}`);
  const connected = Boolean(status?.connected);
  return [{
    broker: 'dhan',
    client_id: String(status?.client_id || ''),
    is_enabled: Boolean(status?.token_stored ?? connected),
    has_session: connected,
    live_enabled: connected,
    daily_session_ok: Boolean(status?.daily_session_ok),
    token_stored: Boolean(status?.token_stored ?? connected),
    last_auth_at: status?.last_auth_at || null,
  }];
};

export const saveBrokerSetup = ({ user_id, broker, client_id, is_enabled, has_session }) =>
  (String(broker || '').toLowerCase() === 'dhan'
    ? Promise.resolve({
        status: 'ok',
        data: {
          broker: 'dhan',
          client_id: String(client_id || ''),
          is_enabled: Boolean(is_enabled),
          has_session: Boolean(has_session),
        },
      })
    : tradeApiPost('/brokers/setup', {
        user_id,
        broker: String(broker || '').toLowerCase(),
        client_id: String(client_id || ''),
        is_enabled: Boolean(is_enabled),
        ...(typeof has_session === 'boolean' ? { has_session } : {}),
      }));

export const validateBrokerSetup = ({
  user_id,
  broker,
  client_id,
  pin,
  totp,
  api_key,
  client_secret,
  redirect_uri,
  auth_code,
  access_token,
}) => {
  if (String(broker || '').toLowerCase() === 'dhan') {
    return tradeApiGet(`/dhan/status?user_id=${encodeURIComponent(String(user_id || ''))}`)
      .then((s) => ({
        validated: Boolean(s?.connected),
        reason: s?.connected ? '' : 'Dhan session is not active yet.',
      }));
  }
  return tradeApiPost('/brokers/validate', {
    user_id,
    broker,
    client_id,
    pin,
    totp,
    api_key,
    client_secret,
    redirect_uri,
    auth_code,
    access_token,
  });
};

export const clearBrokerSession = ({ user_id, broker }) => {
  const b = String(broker || '').toLowerCase();
  if (b === 'dhan') return tradeApiPost('/dhan/disconnect', { user_id });
  if (b === 'angelone') return tradeApiPost('/angelone/disconnect', { user_id });
  if (b === 'samco') return tradeApiPost('/samco/disconnect', { user_id });
  if (b === 'upstox') return tradeApiPost('/upstox/disconnect', { user_id });
  return tradeApiPost('/brokers/session/clear', { user_id, ...(broker ? { broker } : {}) });
};
