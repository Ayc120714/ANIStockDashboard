/**
 * In-app APK update helpers.
 *
 * Important: do not short-circuit on a leftover on-disk APK from JS.
 * Native code decides whether a cached file is a newer, installable package.
 * Older builds that treated any zip-magic file as success never re-downloaded
 * and left users stuck unable to update.
 */
import {Alert, Linking, NativeModules, Platform, ToastAndroid} from 'react-native';
import {APP_DIRECT_APK_URL} from '@core/config/appVersion';

const {ApkUpdate} = NativeModules;
/** Keep short so a hung DownloadManager cannot block "Install now" for 15 minutes. */
const UPDATE_DOWNLOAD_TIMEOUT_MS = 120_000;

export function getApkUpdateErrorCode(error) {
  return String(error?.code || error?.userInfo?.code || '').trim();
}

export function isInstallPermissionError(error) {
  return getApkUpdateErrorCode(error) === 'INSTALL_PERMISSION';
}

export function isNativeApkUpdateAvailable() {
  return Platform.OS === 'android' && Boolean(ApkUpdate?.downloadAndInstall);
}

/** Launch the package installer when a prior in-app download left a newer APK on disk. */
export async function tryInstallCachedApkUpdate() {
  if (Platform.OS !== 'android' || !ApkUpdate?.installDownloadedApkIfPresent) {
    return false;
  }
  try {
    return Boolean(await ApkUpdate.installDownloadedApkIfPresent());
  } catch {
    return false;
  }
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
  const message = 'Downloading update…';
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

/**
 * Download + install. Always recovers via browser if native fails for any reason
 * (including missing "Install unknown apps" permission).
 */
export async function downloadAndInstallAppUpdate(apkUrl) {
  const downloadUrl = resolveApkDownloadUrl(apkUrl);

  // Always kick off a browser download first so a broken in-app installer
  // (corrupt cache short-circuit on older builds) cannot leave the user with
  // zero network traffic. Native install still runs when available.
  try {
    await openBrowserDownload(downloadUrl);
  } catch {
    /* native path may still succeed */
  }

  if (isNativeApkUpdateAvailable()) {
    try {
      return await withTimeout(
        ApkUpdate.downloadAndInstall(downloadUrl),
        UPDATE_DOWNLOAD_TIMEOUT_MS,
        'Update download timed out. Open the APK from your browser Downloads to finish.',
      );
    } catch (error) {
      Alert.alert(
        isInstallPermissionError(error) ? 'Allow installs, or use browser' : 'Finish from Downloads',
        isInstallPermissionError(error)
          ? 'Allow "Install unknown apps" for Chrome (or ANI Stock), then open the APK from Downloads.'
          : 'Your browser should have the APK. Open Downloads and tap ani-stock-release.apk to install.',
      );
      return true;
    }
  }

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
      ? 'Return to ANI Stock after enabling installs — or open the APK from your browser Downloads.'
      : 'Allow "Install unknown apps" for ANI Stock or Chrome, then try again.'
    : '';
  Alert.alert(
    title,
    [message, permissionHint, `Manual download:\n${APP_DIRECT_APK_URL}`]
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
