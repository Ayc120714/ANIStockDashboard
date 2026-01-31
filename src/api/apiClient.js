const BASE_URL = 'http://localhost:8000/api';

const defaultHeaders = {
  'Content-Type': 'application/json'
};

const requestInterceptors = [];
const responseInterceptors = [];

export const addRequestInterceptor = (interceptor) => {
  requestInterceptors.push(interceptor);
};

export const addResponseInterceptor = (interceptor) => {
  responseInterceptors.push(interceptor);
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
  const config = await runRequestInterceptors({
    method: 'GET',
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers || {})
    }
  });

  const response = await fetch(buildUrl(endpoint), config);
  const interceptedResponse = await runResponseInterceptors(response);

  if (!interceptedResponse.ok) {
    const errorText = await interceptedResponse.text().catch(() => '');
    const errorMessage = errorText || `Request failed: ${interceptedResponse.status}`;
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
