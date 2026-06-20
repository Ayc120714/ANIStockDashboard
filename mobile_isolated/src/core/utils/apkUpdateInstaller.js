import {Alert, Linking, NativeModules, Platform} from 'react-native';
import {APP_DIRECT_APK_URL} from '@core/config/appVersion';

const {ApkUpdate} = NativeModules;

/** Resolve tracked/redirect URLs to the static release APK file. */
export function resolveApkDownloadUrl(apkUrl) {
  const raw = String(apkUrl || '').trim();
  if (!raw || raw.includes('/apk-download')) {
    return APP_DIRECT_APK_URL;
  }
  return raw;
}

export async function downloadAndInstallAppUpdate(apkUrl) {
  const downloadUrl = resolveApkDownloadUrl(apkUrl);

  if (Platform.OS === 'android' && ApkUpdate?.downloadAndInstall) {
    return ApkUpdate.downloadAndInstall(downloadUrl);
  }

  try {
    await Linking.openURL(downloadUrl);
    return true;
  } catch (error) {
    throw new Error(error?.message || 'Could not open the update download link.');
  }
}

export function showUpdateDownloadError(error) {
  const code = String(error?.code || error?.userInfo?.code || '').trim();
  const message =
    String(error?.message || error || '').trim() ||
    'Could not download the update. Check your connection and try again.';
  const title =
    code === 'INSTALL_PERMISSION' ? 'Allow app installs' : 'Update failed';
  Alert.alert(
    title,
    `${message}\n\nYou can also download manually from:\n${APP_DIRECT_APK_URL}`,
    [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Open link',
        onPress: () => {
          Linking.openURL(APP_DIRECT_APK_URL).catch(() => {});
        },
      },
    ],
  );
}
