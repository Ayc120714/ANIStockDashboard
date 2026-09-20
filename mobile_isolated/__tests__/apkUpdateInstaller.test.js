import fs from 'fs';
import path from 'path';
import {
  getApkUpdateErrorCode,
  isInstallPermissionError,
  isNativeApkUpdateAvailable,
  resolveApkDownloadUrl,
  tryInstallCachedApkUpdate,
} from '@core/utils/apkUpdateInstaller';
import {APP_DIRECT_APK_URL} from '@core/config/appVersion';

const promptSource = fs.readFileSync(
  path.join(__dirname, '../src/hooks/useAppUpdatePrompt.js'),
  'utf8',
);
const installerSource = fs.readFileSync(
  path.join(__dirname, '../src/core/utils/apkUpdateInstaller.js'),
  'utf8',
);

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

  it('returns false when no cached APK installer bridge is available', async () => {
    await expect(tryInstallCachedApkUpdate()).resolves.toBe(false);
  });

  it('does not short-circuit Install now on a leftover cached APK (stuck 1.2.117 regression)', () => {
    // Users on 1.2.117 tapped Install now, JS reused a corrupt zip-magic file,
    // never called track-apk-download / never GETed the APK, and stayed on 102.
    expect(promptSource).not.toMatch(/const launchedCached = await tryInstallCachedApkUpdate\(\)/);
    expect(promptSource).toMatch(/Do not short-circuit on a leftover cached APK/);
    expect(promptSource).toMatch(/text: 'Browser'/);
  });

  it('opens the APK in the browser before native install so stuck older builds still get a file', () => {
    expect(installerSource).toMatch(/UPDATE_DOWNLOAD_TIMEOUT_MS = 120_000/);
    expect(installerSource).toMatch(/Always kick off a browser download first/);
    const fn = installerSource.slice(
      installerSource.indexOf('export async function downloadAndInstallAppUpdate'),
      installerSource.indexOf('export function showInstallPromptAlert'),
    );
    const browserFirst = fn.indexOf('openBrowserDownload(downloadUrl)');
    const nativeCall = fn.indexOf('ApkUpdate.downloadAndInstall(downloadUrl)');
    expect(browserFirst).toBeGreaterThanOrEqual(0);
    expect(nativeCall).toBeGreaterThan(browserFirst);
  });
});
