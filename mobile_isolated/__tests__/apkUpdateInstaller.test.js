import {
  getApkUpdateErrorCode,
  isInstallPermissionError,
  isNativeApkUpdateAvailable,
  resolveApkDownloadUrl,
} from '@core/utils/apkUpdateInstaller';
import {APP_DIRECT_APK_URL} from '@core/config/appVersion';

describe('apkUpdateInstaller', () => {
  it('detects install-permission errors from native reject codes', () => {
    expect(getApkUpdateErrorCode({code: 'INSTALL_PERMISSION'})).toBe('INSTALL_PERMISSION');
    expect(isInstallPermissionError({code: 'INSTALL_PERMISSION'})).toBe(true);
    expect(isInstallPermissionError({code: 'DOWNLOAD_FAILED'})).toBe(false);
  });

  it('resolves tracked apk-download URLs to the static release APK', () => {
    expect(
      resolveApkDownloadUrl('https://www.aycindustries.com/api/mobile/apk-download?source=download_json&v=1.2.70'),
    ).toBe(APP_DIRECT_APK_URL);
    expect(resolveApkDownloadUrl('https://example.com/custom.apk')).toBe('https://example.com/custom.apk');
    expect(resolveApkDownloadUrl('')).toBe(APP_DIRECT_APK_URL);
  });

  it('reports native in-app update availability from the bridge module', () => {
    expect(typeof isNativeApkUpdateAvailable()).toBe('boolean');
  });
});
