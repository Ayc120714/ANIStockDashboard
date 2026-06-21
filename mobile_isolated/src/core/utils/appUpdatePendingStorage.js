import AsyncStorage from '@react-native-async-storage/async-storage';
import {STORAGE_KEYS} from '@core/storage/keys';

export function normalizePendingAppUpdate(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const apkUrl = String(raw.apkUrl || '').trim();
  const remoteCode = Number(raw.remoteCode);
  if (!apkUrl || !Number.isFinite(remoteCode) || remoteCode <= 0) return null;
  return {
    apkUrl,
    remoteCode,
    version: String(raw.version || '').trim(),
  };
}

export async function loadPendingAppUpdate() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.pendingAppUpdate);
    if (!raw) return null;
    return normalizePendingAppUpdate(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function savePendingAppUpdate(pending) {
  const normalized = normalizePendingAppUpdate(pending);
  if (!normalized) return;
  await AsyncStorage.setItem(STORAGE_KEYS.pendingAppUpdate, JSON.stringify(normalized));
}

export async function clearPendingAppUpdate() {
  await AsyncStorage.removeItem(STORAGE_KEYS.pendingAppUpdate);
}
