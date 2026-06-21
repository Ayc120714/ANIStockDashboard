import {useCallback, useEffect, useRef} from 'react';
import {Alert, AppState, InteractionManager} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {APP_VERSION_CODE, APP_VERSION_NAME} from '@core/config/appVersion';
import {STORAGE_KEYS} from '@core/storage/keys';
import {trackApkDownload} from '@core/api/services/mobileService';
import {fetchAppUpdateManifest, isAppUpdateAvailable} from '@core/utils/appUpdateCheck';
import {shouldAutoResumePendingUpdate} from '@core/utils/appUpdatePending';
import {
  clearPendingAppUpdate,
  loadPendingAppUpdate,
  savePendingAppUpdate,
} from '@core/utils/appUpdatePendingStorage';
import {
  canInstallApkPackages,
  downloadAndInstallAppUpdate,
  isInstallPermissionError,
  openApkDownloadFallback,
  resolveApkDownloadUrl,
  showInstallPromptAlert,
  showUpdateDownloadError,
  showUpdateStartingFeedback,
} from '@core/utils/apkUpdateInstaller';

const UPDATE_POLL_MS = 15 * 60 * 1000;
const RESUME_DELAY_MS = 500;
const ALERT_ACTION_DELAY_MS = 300;

function buildUpdateMessage(manifest) {
  const lines = [
    `A new version of ANI Stock (${manifest.version}) is available.`,
    `You are on v${APP_VERSION_NAME} (build ${APP_VERSION_CODE}).`,
    'Tap Update now to download and install the latest APK.',
  ];
  if (manifest.releaseNotes) {
    lines.push('', manifest.releaseNotes);
  }
  return lines.join('\n');
}

function buildPendingUpdate(manifest) {
  const remoteCode = Number(manifest.versionCode);
  return {
    apkUrl: resolveApkDownloadUrl(manifest.apkUrl),
    version: manifest.version,
    remoteCode,
  };
}

async function rememberDismissedUpdate(remoteCode) {
  if (!Number.isFinite(remoteCode) || remoteCode <= 0) return;
  await AsyncStorage.setItem(STORAGE_KEYS.dismissedUpdateCode, String(remoteCode));
  await clearPendingAppUpdate();
}

function shouldPromptForManifest(manifest, dismissedCode, lastPromptedCode) {
  if (!manifest || !isAppUpdateAvailable(manifest)) {
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

async function syncDismissedUpdateState(manifest) {
  if (!manifest || isAppUpdateAvailable(manifest)) {
    return Number(await AsyncStorage.getItem(STORAGE_KEYS.dismissedUpdateCode));
  }

  await AsyncStorage.removeItem(STORAGE_KEYS.dismissedUpdateCode);
  await clearPendingAppUpdate();
  return NaN;
}

/**
 * Checks DOWNLOAD.json and shows an update popup whenever the published APK
 * versionCode is newer than the installed build. Only "Later" snoozes the prompt.
 */
export function useAppUpdatePrompt({enabled = true} = {}) {
  const checkingRef = useRef(false);
  const updatingRef = useRef(false);
  const lastPromptedCodeRef = useRef(0);
  const pendingUpdateRef = useRef(null);
  const resumeTimerRef = useRef(null);

  const setPendingUpdate = useCallback(async pending => {
    pendingUpdateRef.current = pending;
    if (pending) {
      await savePendingAppUpdate(pending);
    } else {
      await clearPendingAppUpdate();
    }
  }, []);

  const runAppUpdate = useCallback(async (pending, {trackDownload = true} = {}) => {
    if (!pending?.apkUrl) {
      showUpdateDownloadError(new Error('Update link is missing. Try again or download manually.'));
      return false;
    }

    showUpdateStartingFeedback();

    try {
      await setPendingUpdate(pending);

      if (trackDownload) {
        void trackApkDownload({targetVersion: pending.version, source: 'update_prompt'});
      }

      await downloadAndInstallAppUpdate(pending.apkUrl);
      showInstallPromptAlert();
      return true;
    } catch (error) {
      if (isInstallPermissionError(error)) {
        await setPendingUpdate(pending);
        showUpdateDownloadError(error, {awaitingPermission: true});
        return false;
      }
      await setPendingUpdate(null);
      showUpdateDownloadError(error);
      return false;
    }
  }, [setPendingUpdate]);

  const startAppUpdate = useCallback((pending, {trackDownload = true} = {}) => {
    if (updatingRef.current) return;
    updatingRef.current = true;
    runAppUpdate(pending, {trackDownload}).finally(() => {
      updatingRef.current = false;
    });
  }, [runAppUpdate]);

  const resumePendingUpdate = useCallback(async () => {
    if (!pendingUpdateRef.current) {
      pendingUpdateRef.current = await loadPendingAppUpdate();
    }

    const pending = pendingUpdateRef.current;
    const canInstall = await canInstallApkPackages();
    if (!shouldAutoResumePendingUpdate({
      pendingUpdate: pending,
      canInstall,
      updating: updatingRef.current,
    })) {
      return;
    }

    startAppUpdate(pending, {trackDownload: false});
  }, [startAppUpdate]);

  const scheduleResumePendingUpdate = useCallback(() => {
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current);
    }
    resumeTimerRef.current = setTimeout(() => {
      resumeTimerRef.current = null;
      resumePendingUpdate();
    }, RESUME_DELAY_MS);
  }, [resumePendingUpdate]);

  const queueAppUpdateFromAlert = useCallback(pending => {
    InteractionManager.runAfterInteractions(() => {
      setTimeout(() => {
        startAppUpdate(pending);
      }, ALERT_ACTION_DELAY_MS);
    });
  }, [startAppUpdate]);

  const showUpdateAlert = useCallback(manifest => {
    const remoteCode = Number(manifest.versionCode);
    lastPromptedCodeRef.current = remoteCode;
    const pending = buildPendingUpdate(manifest);

    Alert.alert(
      'App update available',
      buildUpdateMessage(manifest),
      [
        {
          text: 'Later',
          style: 'cancel',
          onPress: () => {
            rememberDismissedUpdate(remoteCode).catch(() => {});
          },
        },
        {
          text: 'Update now',
          onPress: () => {
            queueAppUpdateFromAlert(pending);
          },
        },
      ],
      {cancelable: false},
    );
  }, [queueAppUpdateFromAlert]);

  const checkForUpdate = useCallback(async () => {
    if (!enabled || checkingRef.current) return;
    checkingRef.current = true;
    try {
      const manifest = await fetchAppUpdateManifest();
      if (!manifest) return;

      const dismissedCode = await syncDismissedUpdateState(manifest);

      if (shouldPromptForManifest(manifest, dismissedCode, lastPromptedCodeRef.current)) {
        showUpdateAlert(manifest);
      }
    } finally {
      checkingRef.current = false;
    }
  }, [enabled, showUpdateAlert]);

  useEffect(() => {
    if (!enabled) return undefined;

    loadPendingAppUpdate().then(pending => {
      if (pending) {
        pendingUpdateRef.current = pending;
        scheduleResumePendingUpdate();
      }
    });

    checkForUpdate();
    const bootTimer = setTimeout(checkForUpdate, 2500);

    const pollTimer = setInterval(() => {
      if (AppState.currentState === 'active') {
        checkForUpdate();
      }
    }, UPDATE_POLL_MS);

    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        scheduleResumePendingUpdate();
        checkForUpdate();
      }
    });

    return () => {
      clearTimeout(bootTimer);
      clearInterval(pollTimer);
      if (resumeTimerRef.current) {
        clearTimeout(resumeTimerRef.current);
      }
      sub.remove();
    };
  }, [checkForUpdate, enabled, scheduleResumePendingUpdate]);

  return {checkForUpdate, installedVersion: APP_VERSION_NAME};
}
