import { tradeApiGet, tradeApiPost } from './tradeApiClient';

export const fetchBrokerOptions = () => tradeApiGet('/brokers/options');

export const fetchBrokerSetup = async ({ userId } = {}) => {
  const suffix = userId ? `?user_id=${encodeURIComponent(String(userId))}` : '';
  const data = await tradeApiGet(`/brokers/setup${suffix}`);
  return data?.data ?? [];
};

export const saveBrokerSetup = ({ user_id, broker, client_id, is_enabled, has_session }) =>
  tradeApiPost('/brokers/setup', {
    user_id,
    broker,
    client_id,
    is_enabled: Boolean(is_enabled),
    ...(typeof has_session === 'boolean' ? { has_session } : {}),
  });

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
}) =>
  tradeApiPost('/brokers/validate', {
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

export const clearBrokerSession = ({ user_id, broker }) =>
  tradeApiPost('/brokers/session/clear', { user_id, ...(broker ? { broker } : {}) });
