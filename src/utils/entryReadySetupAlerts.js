import {
  diffNewEntryReadySetups,
  entryReadySetupsDigest,
  filterEntryReadySetupRows,
} from './liveSetupsPayload';

export const ENTRY_READY_DIGEST_STORAGE_KEY = 'entry_ready_alerts_digest_v1';

export function loadEntryReadyDigest() {
  try {
    return localStorage.getItem(ENTRY_READY_DIGEST_STORAGE_KEY) || '';
  } catch (_) {
    return '';
  }
}

export function saveEntryReadyDigest(digest) {
  try {
    localStorage.setItem(ENTRY_READY_DIGEST_STORAGE_KEY, String(digest || ''));
  } catch (_) {
    /* ignore */
  }
}

export function buildEntryReadyPopupMessage(rows = []) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return '';
  const names = list
    .slice(0, 4)
    .map((row) => String(row?.symbol || '').trim().toUpperCase())
    .filter(Boolean)
    .join(', ');
  if (list.length === 1) {
    return `Entry ready: ${names}. Review levels and place a trade.`;
  }
  return `Entry ready · ${list.length} stocks: ${names}. Review levels and place a trade.`;
}

export function notifyEntryReadyBrowser(rows = []) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  const list = filterEntryReadySetupRows(rows);
  if (!list.length) return;

  const names = list
    .slice(0, 4)
    .map((row) => String(row?.symbol || '').trim().toUpperCase())
    .filter(Boolean)
    .join(', ');
  const title = list.length === 1 ? `Entry ready · ${names}` : `Entry ready · ${list.length} stocks`;
  const body = buildEntryReadyPopupMessage(list);

  const show = () => {
    try {
      new Notification(title, { body, tag: 'entry-ready-alert' });
    } catch (_) {
      /* ignore */
    }
  };

  if (Notification.permission === 'granted') {
    show();
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') show();
    }).catch(() => {});
  }
}

/**
 * Compare current entry-ready rows against stored digest.
 * Returns newly appeared rows and persists the latest digest.
 */
export function detectNewEntryReadySetups(rows = [], { bootstrap = false } = {}) {
  const entryReady = filterEntryReadySetupRows(rows);
  const digest = entryReadySetupsDigest(entryReady);
  const prev = loadEntryReadyDigest();
  const fresh = !bootstrap && prev ? diffNewEntryReadySetups(prev, entryReady) : [];
  saveEntryReadyDigest(digest);
  return { entryReady, fresh, digest };
}
