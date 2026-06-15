import AsyncStorage from '@react-native-async-storage/async-storage';
import {STORAGE_KEYS} from '@core/storage/keys';
import {parseAdvisorAlertMs} from '@core/utils/alertInboxUtils';
import {
  ADVISOR_TABLE_KEYS,
  ADVISOR_TABLE_META,
  diffNewTableSymbols,
  tableSymbolsDigest,
} from '@core/utils/advisorTableSnapshots';

const MAX_EVENTS = 300;

function nowIso() {
  return new Date().toISOString();
}

export async function loadAdvisorTableDigests() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.advisorTableDigests);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function saveAdvisorTableDigests(digests) {
  await AsyncStorage.setItem(STORAGE_KEYS.advisorTableDigests, JSON.stringify(digests || {}));
}

export async function loadAdvisorTableChangeEvents() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.advisorTableChangeEvents);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveAdvisorTableChangeEvents(events) {
  const trimmed = (Array.isArray(events) ? events : []).slice(0, MAX_EVENTS);
  await AsyncStorage.setItem(STORAGE_KEYS.advisorTableChangeEvents, JSON.stringify(trimmed));
}

/** Persist read state for a stored table-change event so polls do not resurrect it as unread. */
export async function markTableChangeEventRead(eventId) {
  const id = String(eventId || '').trim();
  if (!id) return;
  const events = await loadAdvisorTableChangeEvents();
  let changed = false;
  const updated = events.map(event => {
    if (String(event?.id || '') !== id) return event;
    if (event.isRead) return event;
    changed = true;
    return {...event, isRead: true};
  });
  if (changed) {
    await saveAdvisorTableChangeEvents(updated);
  }
}

export async function markAllTableChangeEventsRead() {
  const events = await loadAdvisorTableChangeEvents();
  if (!events.length) return;
  const allRead = events.every(event => event.isRead);
  if (allRead) return;
  await saveAdvisorTableChangeEvents(events.map(event => ({...event, isRead: true})));
}

export function buildTableChangeEvent(tableKey, symbol, detectedAt = nowIso()) {
  const meta = ADVISOR_TABLE_META[tableKey] || {};
  const ts = detectedAt || nowIso();
  return {
    id: `${tableKey}:${symbol}:${ts}`,
    tableKey,
    source: meta.source || tableKey,
    sourceLabel: meta.label || tableKey,
    symbol: String(symbol || '').trim().toUpperCase(),
    title: meta.title || 'New table entry',
    subtitle: meta.label || tableKey,
    timestamp: ts,
    timestampMs: parseAdvisorAlertMs(ts),
    advisorTab: meta.advisorTab,
    screensMain: meta.screensMain,
    trendTf: meta.trendTf,
    isRead: false,
  };
}

export function normalizeTableChangeEvents(events = []) {
  return (Array.isArray(events) ? events : [])
    .map(event => ({
      ...event,
      timestampMs: parseAdvisorAlertMs(event?.timestamp),
    }))
    .sort((a, b) => (b.timestampMs || 0) - (a.timestampMs || 0));
}

/**
 * Compare snapshots to prior digests; emit one event per newly added symbol per table.
 * On bootstrap (no prior digest), only seeds digests — no events.
 */
export function diffAdvisorTableSnapshots(prevDigests = {}, snapshots = {}) {
  const nextDigests = {...prevDigests};
  const newEvents = [];

  for (const tableKey of Object.values(ADVISOR_TABLE_KEYS)) {
    const symbols = snapshots[tableKey] || [];
    const nextDigest = tableSymbolsDigest(symbols);
    const prevDigest = prevDigests[tableKey];
    nextDigests[tableKey] = nextDigest;

    if (prevDigest == null) continue;

    const prevSymbols = String(prevDigest).split(',').filter(Boolean);
    const added = diffNewTableSymbols(prevSymbols, symbols);
    const detectedAt = nowIso();
    for (const symbol of added) {
      newEvents.push(buildTableChangeEvent(tableKey, symbol, detectedAt));
    }
  }

  return {newEvents, nextDigests, bootstrapped: Object.keys(prevDigests).length === 0};
}

export async function processAdvisorTableSnapshots(snapshots) {
  const [prevDigests, prevEvents] = await Promise.all([
    loadAdvisorTableDigests(),
    loadAdvisorTableChangeEvents(),
  ]);
  const {newEvents, nextDigests, bootstrapped} = diffAdvisorTableSnapshots(prevDigests, snapshots);
  const mergedEvents = normalizeTableChangeEvents([...newEvents, ...prevEvents]);
  await Promise.all([
    saveAdvisorTableDigests(nextDigests),
    saveAdvisorTableChangeEvents(mergedEvents),
  ]);
  return {events: mergedEvents, newEvents, bootstrapped};
}
