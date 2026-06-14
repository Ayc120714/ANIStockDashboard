import {useCallback, useEffect, useRef} from 'react';
import {Alert, AppState} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {APP_VERSION_CODE, APP_VERSION_NAME} from '@core/config/appVersion';
import {STORAGE_KEYS} from '@core/storage/keys';
import {trackApkDownload} from '@core/api/services/mobileService';
import {fetchAppUpdateManifest, isAppUpdateAvailable} from '@core/utils/appUpdateCheck';
import {downloadAndInstallAppUpdate, showUpdateDownloadError} from '@core/utils/apkUpdateInstaller';

const UPDATE_POLL_MS = 15 * 60 * 1000;

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

async function rememberHandledUpdate(remoteCode) {
  if (!Number.isFinite(remoteCode) || remoteCode <= 0) return;
  await AsyncStorage.setItem(STORAGE_KEYS.dismissedUpdateCode, String(remoteCode));
}

async function startAppUpdate(apkUrl, targetVersion, remoteCode) {
  await rememberHandledUpdate(remoteCode);
  await trackApkDownload({targetVersion, source: 'update_prompt'});
  try {
    await downloadAndInstallAppUpdate(apkUrl);
  } catch (error) {
    showUpdateDownloadError(error);
  }
}

function shouldPromptForManifest(manifest, handledCode, lastPromptedCode) {
  if (!manifest || !isAppUpdateAvailable(manifest)) {
    return false;
  }
  const remoteCode = Number(manifest.versionCode);
  if (!Number.isFinite(remoteCode) || remoteCode <= 0) {
    return false;
  }
  if (Number.isFinite(handledCode) && handledCode >= remoteCode) {
    return false;
  }
  if (lastPromptedCode === remoteCode) {
    return false;
  }
  return true;
}

async function syncHandledUpdateState(manifest) {
  if (!manifest || isAppUpdateAvailable(manifest)) {
    return Number(await AsyncStorage.getItem(STORAGE_KEYS.dismissedUpdateCode));
  }

  await AsyncStorage.removeItem(STORAGE_KEYS.dismissedUpdateCode);
  return NaN;
}

/**
 * Checks DOWNLOAD.json and shows an update popup whenever the published APK
 * versionCode is newer than the installed build. "Later" and "Update now" both
 * snooze the current published version until a newer APK is published.
 */
export function useAppUpdatePrompt({enabled = true} = {}) {
  const checkingRef = useRef(false);
  const updatingRef = useRef(false);
  const lastPromptedCodeRef = useRef(0);

  const showUpdateAlert = useCallback(manifest => {
    const remoteCode = Number(manifest.versionCode);
    lastPromptedCodeRef.current = remoteCode;

    Alert.alert(
      'App update available',
      buildUpdateMessage(manifest),
      [
        {
          text: 'Later',
          style: 'cancel',
          onPress: () => {
            rememberHandledUpdate(remoteCode).catch(() => {});
          },
        },
        {
          text: 'Update now',
          onPress: () => {
            if (updatingRef.current) return;
            updatingRef.current = true;
            startAppUpdate(manifest.apkUrl, manifest.version, remoteCode).finally(() => {
              updatingRef.current = false;
            });
          },
        },
      ],
      {cancelable: false},
    );
  }, []);

  const checkForUpdate = useCallback(async () => {
    if (!enabled || checkingRef.current) return;
    checkingRef.current = true;
    try {
      const manifest = await fetchAppUpdateManifest();
      if (!manifest) return;

      const handledCode = await syncHandledUpdateState(manifest);

      if (shouldPromptForManifest(manifest, handledCode, lastPromptedCodeRef.current)) {
        showUpdateAlert(manifest);
      }
    } finally {
      checkingRef.current = false;
    }
  }, [enabled, showUpdateAlert]);

  useEffect(() => {
    if (!enabled) return undefined;

    checkForUpdate();
    const bootTimer = setTimeout(checkForUpdate, 2500);

    const pollTimer = setInterval(() => {
      if (AppState.currentState === 'active') {
        checkForUpdate();
      }
    }, UPDATE_POLL_MS);

    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        checkForUpdate();
      }
    });

    return () => {
      clearTimeout(bootTimer);
      clearInterval(pollTimer);
      sub.remove();
    };
  }, [checkForUpdate, enabled]);

  return {checkForUpdate, installedVersion: APP_VERSION_NAME};
}
