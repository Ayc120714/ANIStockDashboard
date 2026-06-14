import {apiGet, apiPost} from '@core/api/apiClient';
import {APP_UPDATE_APK_URL, APP_VERSION_CODE, APP_VERSION_NAME} from '@core/config/appVersion';
import {getOrCreateDeviceId} from '@core/utils/deviceId';

export async function registerMobileInstall() {
  const deviceId = await getOrCreateDeviceId();
  return apiPost('/mobile/register-install', {
    device_id: deviceId,
    app_version: APP_VERSION_NAME,
    version_code: APP_VERSION_CODE,
    platform: 'android',
  });
}

export async function fetchMobileInstallStats() {
  return apiGet('/auth/admin/mobile-install-stats');
}

export async function trackApkDownload({targetVersion = APP_VERSION_NAME, source = 'in_app'} = {}) {
  try {
    await apiPost('/mobile/track-apk-download', {
      target_version: targetVersion,
      source,
    });
  } catch {
    /* best-effort */
  }
}

export function getTrackedApkDownloadUrl(targetVersion = APP_VERSION_NAME) {
  const version = encodeURIComponent(String(targetVersion || '').trim());
  return `https://www.aycindustries.com/api/mobile/apk-download?source=in_app&v=${version}`;
}

export const MOBILE_APK_DOWNLOAD_URL = APP_UPDATE_APK_URL;
