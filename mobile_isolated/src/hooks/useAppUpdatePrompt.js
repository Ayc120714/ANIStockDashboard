import {useCallback, useEffect, useRef} from 'react';
import {Alert, AppState, InteractionManager} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {APP_VERSION_CODE, APP_VERSION_NAME} from '@core/config/appVersion';
import {STORAGE_KEYS} from '@core/storage/keys';
import {trackApkDownload} from '@core/api/services/mobileService';
import {fetchAppUpdateManifest, isAppUpdateAvailable} from '@core/utils/appUpdateCheck';
import {
  reconcilePendingAppUpdate,
  shouldAutoResumePendingUpdate,
  shouldShowUpdatePrompt,
} from '@core/utils/appUpdatePending';
import {
  clearPendingAppUpdate,
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
  tryInstallCachedApkUpdate,
} from '@core/utils/apkUpdateInstaller';

const UPDATE_POLL_MS = 15 * 60 * 1000;
const RESUME_DELAY_MS = 500;
const ALERT_ACTION_DELAY_MS = 300;

function buildUpdateMessage(manifest) {
  const lines = [
    `A new version of ANI Stock (${manifest.version}) is available.`,
    `You are on v${APP_VERSION_NAME} (build ${APP_VERSION_CODE}).`,
    'Tap Install now when you are ready — you can finish the setup later.',
  ];
  if (manifest.releaseNotes) {
    lines.push('', manifest.releaseNotes);
  }
  return lines.join('\n');
}

function buildPendingInstallMessage(pending, manifest) {
  const version = pending?.version || manifest?.version || 'latest';
  const lines = [
    `ANI Stock v${version} is ready to install.`,
    `You are on v${APP_VERSION_NAME} (build ${APP_VERSION_CODE}).`,
    'Tap Install now to open the update installer, or Later to continue using the app.',
  ];
  const notes = manifest?.releaseNotes;
  if (notes) {
    lines.push('', notes);
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

function pendingFromManifestOrSaved(pending, manifest) {
  if (pending?.apkUrl) return pending;
  if (manifest && isAppUpdateAvailable(manifest)) {
    return buildPendingUpdate(manifest);
  }
  return null;
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
 * versionCode is newer than the installed build. "Later" defers install but
 * re-prompts the next time the user opens or returns to the app.
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

    const launchedCached = await tryInstallCachedApkUpdate();
    if (launchedCached) {
      showInstallPromptAlert();
      return true;
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
    const pending = await reconcilePendingAppUpdate(APP_VERSION_CODE);
    pendingUpdateRef.current = pending;

    if (pending) {
      const launchedCached = await tryInstallCachedApkUpdate();
      if (launchedCached) {
        showInstallPromptAlert();
        return;
      }
    }

    const canInstall = await canInstallApkPackages();
    if (!shouldAutoResumePendingUpdate({
      pendingUpdate: pending,
      canInstall,
      updating: updatingRef.current,
      installedVersionCode: APP_VERSION_CODE,
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

  const showInstallAlert = useCallback((pending, manifest, {deferred = false} = {}) => {
    const remoteCode = Number(pending?.remoteCode || manifest?.versionCode);
    if (!Number.isFinite(remoteCode) || remoteCode <= 0) return;

    lastPromptedCodeRef.current = remoteCode;
    const message = deferred
      ? buildPendingInstallMessage(pending, manifest)
      : buildUpdateMessage(manifest || {version: pending.version, releaseNotes: ''});

    Alert.alert(
      deferred ? 'Finish app update' : 'App update available',
      message,
      [
        {
          text: 'Later',
          style: 'cancel',
          onPress: () => {
            setPendingUpdate(pending).catch(() => {});
          },
        },
        {
          text: 'Install now',
          onPress: () => {
            queueAppUpdateFromAlert(pending);
          },
        },
      ],
      {cancelable: false},
    );
  }, [queueAppUpdateFromAlert, setPendingUpdate]);

  const checkForUpdate = useCallback(async () => {
    if (!enabled || checkingRef.current) return;
    checkingRef.current = true;
    try {
      const pending = await reconcilePendingAppUpdate(APP_VERSION_CODE);
      pendingUpdateRef.current = pending;

      const manifest = await fetchAppUpdateManifest();
      const dismissedCode = await syncDismissedUpdateState(manifest);
      const installPending = pendingFromManifestOrSaved(pending, manifest);

      if (
        !shouldShowUpdatePrompt({
          manifest,
          pendingUpdate: pending,
          dismissedCode,
          lastPromptedCode: lastPromptedCodeRef.current,
          installedVersionCode: APP_VERSION_CODE,
        })
        || !installPending
      ) {
        return;
      }

      showInstallAlert(installPending, manifest, {deferred: Boolean(pending)});
    } finally {
      checkingRef.current = false;
    }
  }, [enabled, showInstallAlert]);

  useEffect(() => {
    if (!enabled) return undefined;

    reconcilePendingAppUpdate(APP_VERSION_CODE).then(pending => {
      pendingUpdateRef.current = pending;
      if (pending) {
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
      if (state === 'background' || state === 'inactive') {
        lastPromptedCodeRef.current = 0;
      }
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
