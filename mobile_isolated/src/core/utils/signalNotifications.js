import {NativeModules, PermissionsAndroid, Platform, Vibration} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {buildSignalNotificationPayload} from '@core/utils/signalNotificationCopy';

const {SignalNotification} = NativeModules;

const FOREGROUND_VIBRATE_MS = 280;
export const PENDING_ENTRY_HINT_KEY = '@ani/mobile/pending-entry-hint';

export async function ensureNotificationPermission() {
  if (Platform.OS !== 'android') {
    return true;
  }
  if (Platform.Version < 33) {
    return true;
  }
  try {
    const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    if (granted) {
      return true;
    }
    const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

export async function showSystemNotification(title, message) {
  if (Platform.OS !== 'android' || !SignalNotification?.show) {
    return false;
  }
  await ensureNotificationPermission();
  try {
    await SignalNotification.show(title, message);
    return true;
  } catch {
    return false;
  }
}

export async function notifyNewSignals(freshSignals, {vibrateInApp = true} = {}) {
  const payload = buildSignalNotificationPayload(freshSignals);
  if (!payload) {
    return {shown: false, payload: null};
  }

  if (vibrateInApp && Platform.OS === 'android') {
    Vibration.vibrate(FOREGROUND_VIBRATE_MS);
  }

  if (Platform.OS !== 'android' || !SignalNotification?.show) {
    return {shown: false, payload, reason: 'native_module_unavailable'};
  }

  await ensureNotificationPermission();

  try {
    await SignalNotification.show(payload.title, payload.message);
    return {shown: true, payload};
  } catch {
    return {shown: false, payload, reason: 'native_show_failed'};
  }
}

/** Dev/test helper — preview notification without comparing digests. */
export async function previewSignalNotification(sampleRows) {
  return notifyNewSignals(sampleRows, {vibrateInApp: true});
}

export async function queueInAppSignalBanner(payload) {
  if (!payload?.entryHint) return;
  await queueInAppEntryBanner({
    entryHint: payload.entryHint,
    navTarget: payload.navTarget || {type: 'signals'},
  });
}

export async function queueInAppEntryBanner({entryHint, navTarget} = {}) {
  if (!entryHint) return;
  await AsyncStorage.setItem(
    PENDING_ENTRY_HINT_KEY,
    JSON.stringify({
      hint: entryHint,
      navTarget: navTarget || {type: 'signals'},
    }),
  );
}

export async function consumePendingEntryHint() {
  const raw = await AsyncStorage.getItem(PENDING_ENTRY_HINT_KEY);
  if (raw) {
    await AsyncStorage.removeItem(PENDING_ENTRY_HINT_KEY);
  }
  if (!raw) {
    return {hint: '', navTarget: null};
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.hint) {
      return {
        hint: String(parsed.hint),
        navTarget: parsed.navTarget || {type: 'signals'},
      };
    }
  } catch {
    /* legacy plain-string hint */
  }
  return {hint: raw, navTarget: {type: 'signals'}};
}

/** Create backend demo alert + fire mobile notification + queue in-app banner. */
export async function fireDemoSignalAlert({signal} = {}) {
  const row =
    signal && typeof signal === 'object'
      ? signal
      : {
          symbol: 'RELIANCE',
          status: 'entry_ready',
          entry_price: 2850,
          stop_loss: 2780,
          target_1: 2950,
          target_2: 3020,
          trend: 'bullish',
          high_conviction: true,
          updated_at: new Date().toISOString(),
          _demo: true,
        };
  const payload = buildSignalNotificationPayload([row]);
  if (payload) {
    await queueInAppSignalBanner(payload);
  }
  const result = await notifyNewSignals([row], {vibrateInApp: true});
  return {payload, result, signal: row};
}
