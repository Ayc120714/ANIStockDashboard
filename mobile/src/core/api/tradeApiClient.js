import {apiRequest} from '@core/api/apiClient';
import {env, buildUrl} from '@core/config/env';

export const tradeApiRequest = async (endpoint, options = {}) => {
  const primaryUrl = buildUrl(env.tradeApiUrl, endpoint);
  try {
    return await apiRequest(primaryUrl, options);
  } catch (error) {
    const fallbackUrl = buildUrl(env.apiUrl, endpoint);
    const networkFailure = String(error?.message || '').includes('Unable to reach server');
    if (!networkFailure || !fallbackUrl || fallbackUrl === primaryUrl) {
      throw error;
    }
    return apiRequest(fallbackUrl, options);
  }
};

export const tradeApiGet = (endpoint, options = {}) =>
  tradeApiRequest(endpoint, {...options, method: 'GET'});
export const tradeApiPost = (endpoint, body, options = {}) =>
  tradeApiRequest(endpoint, {
    ...options,
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
