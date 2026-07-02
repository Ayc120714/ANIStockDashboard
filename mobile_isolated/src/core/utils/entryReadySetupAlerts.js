import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  diffNewEntryReadySetups,
  entryReadySetupsDigest,
  filterEntryReadySetupRows,
} from '@core/utils/liveSetupsPayload';
import {STORAGE_KEYS} from '@core/storage/keys';
import {showSystemNotification} from '@core/utils/signalNotifications';

export function buildEntryReadyPopupMessage(rows = []) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return '';
  const names = list
    .slice(0, 4)
    .map(row => String(row?.symbol || '').trim().toUpperCase())
    .filter(Boolean)
    .join(', ');
  if (list.length === 1) {
    return `Entry ready: ${names}. Review levels and place a trade.`;
  }
  return `Entry ready · ${list.length} stocks: ${names}. Review levels and place a trade.`;
}

export async function loadEntryReadyDigest() {
  try {
    return (await AsyncStorage.getItem(STORAGE_KEYS.entryReadyDigest)) || '';
  } catch (_) {
    return '';
  }
}

export async function saveEntryReadyDigest(digest) {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.entryReadyDigest, String(digest || ''));
  } catch (_) {
    /* ignore */
  }
}

export async function detectNewEntryReadySetups(rows = [], {bootstrap = false} = {}) {
  const entryReady = filterEntryReadySetupRows(rows);
  const digest = entryReadySetupsDigest(entryReady);
  const prev = await loadEntryReadyDigest();
  const fresh = !bootstrap && prev ? diffNewEntryReadySetups(prev, entryReady) : [];
  await saveEntryReadyDigest(digest);
  return {entryReady, fresh, digest};
}

export async function notifyEntryReadyPopup(rows = []) {
  const list = filterEntryReadySetupRows(rows);
  if (!list.length) return;
  const message = buildEntryReadyPopupMessage(list);
  const title = list.length === 1
    ? `Entry ready · ${String(list[0]?.symbol || '').toUpperCase()}`
    : `Entry ready · ${list.length} stocks`;
  await showSystemNotification(title, message);
  return message;
}
