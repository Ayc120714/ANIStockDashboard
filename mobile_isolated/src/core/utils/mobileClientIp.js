import AsyncStorage from '@react-native-async-storage/async-storage';
import {v4 as uuidv4} from 'uuid';
import {apiGet, apiPost} from '@core/api/apiClient';
import {STORAGE_KEYS} from '@core/storage/keys';

async function getDeviceId() {
  const existing = await AsyncStorage.getItem(STORAGE_KEYS.deviceId);
  if (existing) return existing;
  const generated = uuidv4();
  await AsyncStorage.setItem(STORAGE_KEYS.deviceId, generated);
  return generated;
}

const withTimeout = (promise, ms = 5000) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);

export async function resolvePublicIpv4() {
  try {
    const r = await withTimeout(fetch('https://api.ipify.org?format=json'), 4500);
    const j = await r.json();
    if (j?.ip) return String(j.ip);
  } catch (_) {
    /* try fallback */
  }
  try {
    const r = await withTimeout(fetch('https://ifconfig.me/all.json'), 4500);
    const j = await r.json();
    if (j?.ip_addr) return String(j.ip_addr);
  } catch (_) {
    return '';
  }
  return '';
}

export function summarizeBrokerEnablements(enablements = []) {
  const rows = Array.isArray(enablements) ? enablements : enablements ? [enablements] : [];
  if (!rows.length) return '';
  const ok = rows.filter(r => r?.status === 'ok').map(r => String(r.broker || '').toUpperCase());
  const manual = rows.filter(r => r?.status === 'manual').map(r => String(r.broker || '').toUpperCase());
  const errors = rows.filter(r => r?.status === 'error');
  const parts = [];
  if (ok.length) parts.push(`IP enabled: ${ok.join(', ')}`);
  if (manual.length) parts.push(`Manual whitelist: ${manual.join(', ')}`);
  if (errors.length) {
    parts.push(
      errors
        .map(e => `${String(e.broker || 'broker').toUpperCase()}: ${e.detail || e.error || 'failed'}`)
        .join(' · '),
    );
  }
  return parts.join(' · ') || 'IP registered — enablement runs on server';
}

/**
 * Resolve device public IP and register with backend for broker IP enablement.
 * Returns { ip, registered, enablement, enablements, connectedBrokers }.
 */
export async function registerMobileClientIp({appVersion = ''} = {}) {
  const ip = await resolvePublicIpv4();
  if (!ip) {
    return {ip: '', registered: null, enablement: null, enablements: [], connectedBrokers: []};
  }
  const deviceId = await getDeviceId();
  const payload = await apiPost('/mobile/register-client-ip', {
    ip,
    device_id: deviceId,
    app_version: appVersion,
  });
  const enablements = payload?.enablements || (payload?.enablement ? [payload.enablement] : []);
  return {
    ip,
    registered: payload?.registered || null,
    enablement: payload?.enablement || enablements[0] || null,
    enablements,
    connectedBrokers: payload?.connected_brokers || [],
  };
}

export async function fetchMobileClientIpStatus() {
  return apiGet('/mobile/client-ip-status');
}

/**
 * Enable mobile IP for one broker or all connected brokers (broker='all').
 */
export async function enableBrokerIpForMobile(ip, broker = 'all') {
  const target = String(broker || 'all').trim().toLowerCase() || 'all';
  return apiPost('/mobile/enable-broker-ip', {ip, broker: target});
}

export async function enableBrokerIpsForMobile(ip, broker = 'all') {
  const payload = await enableBrokerIpForMobile(ip, broker);
  const enablements = payload?.enablements || (payload?.enablement ? [payload.enablement] : []);
  return {
    ...payload,
    enablements,
    summary: summarizeBrokerEnablements(enablements),
  };
}
