import AsyncStorage from '@react-native-async-storage/async-storage';
import {v4 as uuidv4} from 'uuid';
import {env, buildUrl} from '@core/config/env';
import {STORAGE_KEYS} from '@core/storage/keys';
import {decodeObfuscatedPayload} from '@core/utils/obfuscation';

const defaultHeaders = {'Content-Type': 'application/json'};
const DEVICE_ID_HEADER = 'X-Device-Id';
const OBF_RESPONSE_HEADER = 'X-Obf-Response';
const REQUEST_TIMEOUT_MS = 15000;

const requestInterceptors = [];
const responseInterceptors = [];
let authTokenGetter = null;
let unauthorizedHandler = null;

export const addRequestInterceptor = interceptor => requestInterceptors.push(interceptor);
export const addResponseInterceptor = interceptor => responseInterceptors.push(interceptor);
export const configureAuthHandlers = ({getAccessToken, onUnauthorized} = {}) => {
  authTokenGetter = typeof getAccessToken === 'function' ? getAccessToken : null;
  unauthorizedHandler = typeof onUnauthorized === 'function' ? onUnauthorized : null;
};

const runRequestInterceptors = async config => {
  let next = {...config};
  for (const interceptor of requestInterceptors) {
    next = await interceptor(next);
  }
  return next;
};

const runResponseInterceptors = async response => {
  let next = response;
  for (const interceptor of responseInterceptors) {
    next = await interceptor(next);
  }
  return next;
};

const extractApiErrorMessage = payload => {
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
    return (
      extractApiErrorMessage(payload.message) ||
      extractApiErrorMessage(payload.error) ||
      extractApiErrorMessage(payload.reason) ||
      extractApiErrorMessage(payload.detail) ||
      ''
    );
  }
  return '';
};

const getOrCreateDeviceId = async () => {
  const existing = await AsyncStorage.getItem(STORAGE_KEYS.deviceId);
  if (existing) return existing;
  const generated = uuidv4();
  await AsyncStorage.setItem(STORAGE_KEYS.deviceId, generated);
  return generated;
};

const parseError = async response => {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await response.json().catch(() => null);
    return extractApiErrorMessage(data) || `Request failed: ${response.status}`;
  }
  const text = await response.text().catch(() => '');
  return text || `Request failed: ${response.status}`;
};

export const apiRequest = async (endpoint, options = {}) => {
  let bearerToken = authTokenGetter ? await authTokenGetter() : null;
  const deviceId = await getOrCreateDeviceId();
  const baseConfig = await runRequestInterceptors({
    method: 'GET',
    ...options,
    headers: {
      ...defaultHeaders,
      [DEVICE_ID_HEADER]: deviceId,
      [OBF_RESPONSE_HEADER]: '1',
      ...(options.headers || {}),
    },
  });

  const makeRequest = async (token, signal) =>
    fetch(buildUrl(env.apiUrl, endpoint), {
      ...baseConfig,
      signal,
      headers: {
        ...baseConfig.headers,
        ...(token ? {Authorization: `Bearer ${token}`} : {}),
      },
    });

  const requestWithTimeout = async token => {
    const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await makeRequest(token, controller.signal);
    } finally {
      clearTimeout(timeoutId);
    }
  };

  let response;
  try {
    response = await requestWithTimeout(bearerToken);
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Request timed out. Please check backend and network.');
    }
    throw new Error('Unable to reach server. Please check backend and network.');
  }
  let intercepted = await runResponseInterceptors(response);

  if (intercepted.status === 401 && unauthorizedHandler) {
    const nextToken = await unauthorizedHandler(intercepted);
    if (nextToken) {
      bearerToken = nextToken;
      intercepted = await runResponseInterceptors(await requestWithTimeout(nextToken));
    }
  }
  if (!intercepted.ok) {
    throw new Error(await parseError(intercepted));
  }

  const contentType = intercepted.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const parsed = await intercepted.json();
    return decodeObfuscatedPayload(parsed, bearerToken);
  }
  return intercepted.text();
};

export const apiGet = (endpoint, options = {}) => apiRequest(endpoint, {...options, method: 'GET'});
export const apiPost = (endpoint, body, options = {}) =>
  apiRequest(endpoint, {
    ...options,
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
