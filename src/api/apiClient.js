const resolveDefaultApiBaseUrl = () => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api`;
  }
  return '/api';
};

const BASE_URL = process.env.REACT_APP_API_URL || resolveDefaultApiBaseUrl();

const defaultHeaders = {
  'Content-Type': 'application/json'
};
const DEVICE_ID_KEY = 'auth_device_id';
const DEVICE_ID_HEADER = 'X-Device-Id';
const OBF_RESPONSE_HEADER = 'X-Obf-Response';
const OBF_SALT = 'ani-obf-key';

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

/** Nginx/HTML error pages are not user-friendly; map to a short message. */
const humanizeNonJsonError = (status, rawText) => {
  if (status >= 502 && status <= 504) {
    return 'Server temporarily unavailable. The API may be restarting — wait a minute and try again. If this persists, contact support.';
  }
  const t = (rawText || '').trim();
  if (!t) {
    return `Request failed (${status}). Please try again.`;
  }
  if (/^<\s*html[\s>]/i.test(t) || /<title>\s*502/i.test(t) || /<title>\s*503/i.test(t)) {
    return 'The service returned an error page instead of the API. The backend may be down or misconfigured — try again shortly.';
  }
  return t.length > 400 ? `${t.slice(0, 400)}…` : t;
};

const extractApiErrorMessage = (payload) => {
  if (!payload) return '';
  if (typeof payload === 'string') return payload.trim();
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const msg = extractApiErrorMessage(item);
      if (msg) return msg;
    }
    return '';
  }
  if (typeof payload === 'object') {
    const direct =
      extractApiErrorMessage(payload.message)
      || extractApiErrorMessage(payload.error)
      || extractApiErrorMessage(payload.reason)
      || extractApiErrorMessage(payload.reason_code)
      || extractApiErrorMessage(payload.detail);
    if (direct) return direct;

    // FastAPI/Pydantic validation shape: [{loc:[...], msg:'...', type:'...'}]
    if (Array.isArray(payload.errors) && payload.errors.length) {
      const firstMsg = extractApiErrorMessage(payload.errors[0]?.msg || payload.errors[0]);
      if (firstMsg) return firstMsg;
    }
    if (Array.isArray(payload.detail) && payload.detail.length) {
      const firstMsg = extractApiErrorMessage(payload.detail[0]?.msg || payload.detail[0]);
      if (firstMsg) return firstMsg;
    }
  }
  return '';
};

const getOrCreateDeviceId = () => {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const generated =
      (typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `dev_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`);
    localStorage.setItem(DEVICE_ID_KEY, generated);
    return generated;
  } catch (_) {
    return `dev_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
  }
};

const toBase64Bytes = (value) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const deriveObfKey = async (token) => {
  const seed = `${OBF_SALT}:${token || ''}`;
  const data = new TextEncoder().encode(seed);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(digest);
};

const decodeObfuscatedPayload = async (payload, token) => {
  if (!payload || payload.alg !== 'xor-b64-v1' || typeof payload.obf !== 'string') {
    return payload;
  }
  const key = await deriveObfKey(token);
  const bytes = toBase64Bytes(payload.obf);
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) {
    out[i] = bytes[i] ^ key[i % key.length];
  }
  const text = new TextDecoder().decode(out);
  return JSON.parse(text);
};

export const apiRequest = async (endpoint, options = {}) => {
  const bearerToken = authTokenGetter ? authTokenGetter() : null;
  const config = await runRequestInterceptors({
    method: 'GET',
    ...options,
    headers: {
      ...defaultHeaders,
      [DEVICE_ID_HEADER]: getOrCreateDeviceId(),
      [OBF_RESPONSE_HEADER]: '1',
      ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
      ...(options.headers || {})
    }
  });

  let response;
  try {
    response = await fetch(buildUrl(endpoint), {
      ...config,
      cache: options.cache ?? config.cache,
    });
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
        errorMessage = extractApiErrorMessage(detail) || extractApiErrorMessage(data) || errorMessage;
      } else if (typeof data?.message === 'string' && data.message) {
        errorMessage = data.message;
      } else {
        errorMessage = extractApiErrorMessage(data) || errorMessage;
      }
    } else {
      const errorText = await interceptedResponse.text().catch(() => '');
      errorMessage = humanizeNonJsonError(interceptedResponse.status, errorText);
    }
    throw new Error(errorMessage);
  }

  const contentType = interceptedResponse.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const parsed = await interceptedResponse.json();
    return decodeObfuscatedPayload(parsed, bearerToken);
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
