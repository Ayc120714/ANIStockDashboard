import { apiGet, apiPost } from './apiClient';

export const fetchBrokerOptions = () => apiGet('/brokers/options');

export const fetchBrokerSetup = async () => {
  const data = await apiGet('/brokers/setup');
  return data?.data ?? [];
};

export const saveBrokerSetup = ({ broker, client_id, is_enabled }) =>
  apiPost('/brokers/setup', { broker, client_id, is_enabled: Boolean(is_enabled) });

export const validateBrokerSetup = ({
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
  apiPost('/brokers/validate', {
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
