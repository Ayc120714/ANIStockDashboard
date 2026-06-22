import AsyncStorage from '@react-native-async-storage/async-storage';
import {APP_VERSION_CODE} from '@core/config/appVersion';
import {STORAGE_KEYS} from '@core/storage/keys';
import {isAppUpdateAvailable} from '@core/utils/appUpdateCheck';
import {
  clearPendingAppUpdate,
  loadPendingAppUpdate,
} from '@core/utils/appUpdatePendingStorage';

/** True when the installed build already includes the pending remote version. */
export function isPendingUpdateSatisfied(pendingUpdate, installedVersionCode) {
  if (!pendingUpdate) return true;
  const remoteCode = Number(pendingUpdate.remoteCode);
  const installedCode = Number(installedVersionCode);
  if (!Number.isFinite(remoteCode) || remoteCode <= 0) return true;
  if (!Number.isFinite(installedCode)) return false;
  return installedCode >= remoteCode;
}

/**
 * Whether to show the update/install alert (manifest check or deferred pending install).
 * "Later" saves pending state — it must not permanently suppress future prompts.
 */
export function shouldShowUpdatePrompt({
  manifest,
  pendingUpdate,
  dismissedCode,
  lastPromptedCode,
  installedVersionCode = APP_VERSION_CODE,
} = {}) {
  if (pendingUpdate && !isPendingUpdateSatisfied(pendingUpdate, installedVersionCode)) {
    const pendingCode = Number(pendingUpdate.remoteCode);
    if (Number.isFinite(pendingCode) && pendingCode > 0 && lastPromptedCode === pendingCode) {
      return false;
    }
    return true;
  }

  if (!manifest || !isAppUpdateAvailable(manifest, {installedVersionCode})) {
    return false;
  }

  const remoteCode = Number(manifest.versionCode);
  if (!Number.isFinite(remoteCode) || remoteCode <= 0) {
    return false;
  }
  if (Number.isFinite(dismissedCode) && dismissedCode >= remoteCode) {
    return false;
  }
  if (lastPromptedCode === remoteCode) {
    return false;
  }
  return true;
}

/** Whether a pending update should auto-resume after returning from Settings. */
export function shouldAutoResumePendingUpdate({
  pendingUpdate,
  canInstall,
  updating,
  installedVersionCode,
}) {
  if (!pendingUpdate || !canInstall || updating) return false;
  if (isPendingUpdateSatisfied(pendingUpdate, installedVersionCode)) return false;
  return true;
}

/**
 * Clears stale pending update state after a successful in-app install.
 * Returns the pending update only when it still needs to be downloaded.
 */
export async function reconcilePendingAppUpdate(installedVersionCode) {
  const pending = await loadPendingAppUpdate();
  if (!pending) return null;
  if (!isPendingUpdateSatisfied(pending, installedVersionCode)) {
    return pending;
  }

  await clearPendingAppUpdate();
  const remoteCode = Number(pending.remoteCode);
  if (Number.isFinite(remoteCode) && remoteCode > 0) {
    await AsyncStorage.setItem(STORAGE_KEYS.dismissedUpdateCode, String(remoteCode));
  }
  return null;
}
