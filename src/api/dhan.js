import { apiGet, apiPost } from './apiClient';

export const fetchDhanStatus = async () => {
  return apiGet('/dhan/status');
};

export const connectDhan = async ({ client_id, pin, totp }) => {
  return apiPost('/dhan/connect', { client_id, pin, totp });
};

export const disconnectDhan = async () => {
  return apiPost('/dhan/disconnect', {});
};

export const fetchDhanPositions = async () => {
  const data = await apiGet('/dhan/positions');
  return data?.data ?? data;
};

export const fetchDhanOrders = async () => {
  const data = await apiGet('/dhan/orders');
  return data?.data ?? data;
};
