const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8010/api';

const defaultHeaders = {
  'Content-Type': 'application/json'
};

const requestInterceptors = [];
const responseInterceptors = [];
let authTokenGetter = null;
let unauthorizedHandler = null;

export const addRequestInterceptor = (interceptor) => {
  requestInterceptors.push(interceptor);
};

export const addResponseInterceptor = (interceptor) => {
  responseInterceptors.push(interceptor);
};

export const configureAuthHandlers = ({ getAccessToken, onUnauthorized } = {}) => {
  authTokenGetter = typeof getAccessToken === 'function' ? getAccessToken : null;
  unauthorizedHandler = typeof onUnauthorized === 'function' ? onUnauthorized : null;
};

const runRequestInterceptors = async (config) => {
  let nextConfig = { ...config };
  for (const interceptor of requestInterceptors) {
    nextConfig = await interceptor(nextConfig);
  }
  return nextConfig;
};

const runResponseInterceptors = async (response) => {
  let nextResponse = response;
  for (const interceptor of responseInterceptors) {
    nextResponse = await interceptor(nextResponse);
  }
  return nextResponse;
};

const buildUrl = (endpoint) => {
  if (!endpoint) return BASE_URL;
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  const base = BASE_URL.replace(/\/$/, '');
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${base}${path}`;
};

export const apiRequest = async (endpoint, options = {}) => {
  const bearerToken = authTokenGetter ? authTokenGetter() : null;
  const config = await runRequestInterceptors({
    method: 'GET',
    ...options,
    headers: {
      ...defaultHeaders,
      ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
      ...(options.headers || {})
    }
  });

  let response;
  try {
    response = await fetch(buildUrl(endpoint), config);
  } catch (_) {
    throw new Error('Unable to reach server. Please check backend and network.');
  }
  const interceptedResponse = await runResponseInterceptors(response);

  if (interceptedResponse.status === 401 && unauthorizedHandler) {
    unauthorizedHandler(interceptedResponse);
  }

  if (!interceptedResponse.ok) {
    const contentType = interceptedResponse.headers.get('content-type') || '';
    let errorMessage = `Request failed: ${interceptedResponse.status}`;
    if (contentType.includes('application/json')) {
      const data = await interceptedResponse.json().catch(() => null);
      const detail = data?.detail;
      if (typeof detail === 'string' && detail) {
        errorMessage = detail;
      } else if (detail && typeof detail === 'object') {
        errorMessage = detail.message || detail.reason_code || JSON.stringify(detail);
      } else if (typeof data?.message === 'string' && data.message) {
        errorMessage = data.message;
      }
    } else {
      const errorText = await interceptedResponse.text().catch(() => '');
      if (errorText) errorMessage = errorText;
    }
    throw new Error(errorMessage);
  }

  const contentType = interceptedResponse.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return interceptedResponse.json();
  }

  return interceptedResponse.text();
};

export const apiGet = (endpoint, options = {}) => apiRequest(endpoint, { ...options, method: 'GET' });
export const apiPost = (endpoint, body, options = {}) =>
  apiRequest(endpoint, {
    ...options,
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined
  });
