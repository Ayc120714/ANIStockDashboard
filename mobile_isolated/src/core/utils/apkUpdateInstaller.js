import {Alert, Linking, NativeModules, Platform, ToastAndroid} from 'react-native';
import {APP_DIRECT_APK_URL} from '@core/config/appVersion';

const {ApkUpdate} = NativeModules;
const UPDATE_DOWNLOAD_TIMEOUT_MS = 900_000;

export function getApkUpdateErrorCode(error) {
  return String(error?.code || error?.userInfo?.code || '').trim();
}

export function isInstallPermissionError(error) {
  return getApkUpdateErrorCode(error) === 'INSTALL_PERMISSION';
}

export function isNativeApkUpdateAvailable() {
  return Platform.OS === 'android' && Boolean(ApkUpdate?.downloadAndInstall);
}

/** Always use the static release APK URL (no API redirect). */
export function resolveApkDownloadUrl(apkUrl) {
  const raw = String(apkUrl || '').trim();
  if (!raw || raw.includes('/apk-download') || !raw.endsWith('.apk')) {
    return APP_DIRECT_APK_URL;
  }
  return raw;
}

export async function canInstallApkPackages() {
  if (Platform.OS !== 'android') {
    return true;
  }
  if (!ApkUpdate?.canRequestPackageInstalls) {
    return true;
  }
  try {
    return Boolean(await ApkUpdate.canRequestPackageInstalls());
  } catch {
    return false;
  }
}

function withTimeout(promise, timeoutMs, message) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);
    Promise.resolve(promise)
      .then(value => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(error => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export function showUpdateStartingFeedback() {
  const message = 'Downloading update… Check the notification shade for progress.';
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.LONG);
    return;
  }
  Alert.alert('Downloading update', message);
}

async function openBrowserDownload(downloadUrl) {
  if (Platform.OS === 'android' && ApkUpdate?.openApkInBrowser) {
    return ApkUpdate.openApkInBrowser(downloadUrl);
  }
  await Linking.openURL(downloadUrl);
  return true;
}

export async function openApkDownloadFallback() {
  return openBrowserDownload(APP_DIRECT_APK_URL);
}

export async function downloadAndInstallAppUpdate(apkUrl) {
  const downloadUrl = resolveApkDownloadUrl(apkUrl);

  if (isNativeApkUpdateAvailable()) {
    try {
      return await withTimeout(
        ApkUpdate.downloadAndInstall(downloadUrl),
        UPDATE_DOWNLOAD_TIMEOUT_MS,
        'Update download timed out. Check your connection and try again.',
      );
    } catch (error) {
      if (isInstallPermissionError(error)) {
        throw error;
      }
      try {
        await openBrowserDownload(downloadUrl);
        Alert.alert(
          'Download in browser',
          'The in-app download failed. Your browser is downloading the APK — open Downloads and tap the file to install.',
        );
        return true;
      } catch {
        throw error;
      }
    }
  }

  await openBrowserDownload(downloadUrl);
  Alert.alert(
    'Download started',
    'Open your browser downloads and install the APK when the download finishes.',
  );
  return true;
}

export function showInstallPromptAlert() {
  Alert.alert(
    'Install update',
    'The new version was downloaded. Tap Install on the next screen to finish updating ANI Stock.',
    [{text: 'OK'}],
  );
}

export function showUpdateDownloadError(error, {awaitingPermission = false} = {}) {
  const message =
    String(error?.message || error || '').trim() ||
    'Could not download the update. Check your connection and try again.';
  const title = isInstallPermissionError(error)
    ? 'Allow app installs'
    : 'Update failed';
  const permissionHint = isInstallPermissionError(error)
    ? awaitingPermission
      ? 'Return to ANI Stock after enabling installs — the update will start automatically.'
      : 'Allow "Install unknown apps" for ANI Stock in Settings, then try Update again.'
    : '';
  Alert.alert(
    title,
    [message, permissionHint, `You can also download manually from:\n${APP_DIRECT_APK_URL}`]
      .filter(Boolean)
      .join('\n\n'),
    [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Open link',
        onPress: () => {
          openApkDownloadFallback().catch(() => {});
        },
      },
    ],
  );
}
