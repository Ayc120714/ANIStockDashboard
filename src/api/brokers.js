import { tradeApiGet, tradeApiPost } from './tradeApiClient';

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
