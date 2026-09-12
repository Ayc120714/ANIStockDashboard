import fs from 'fs';
import path from 'path';

const androidSrc = path.join(__dirname, '../android/app/src/main');
const filePathsXml = fs.readFileSync(path.join(androidSrc, 'res/xml/file_paths.xml'), 'utf8');
const moduleKt = fs.readFileSync(
  path.join(androidSrc, 'java/com/anistockmobiletemplate/ApkUpdateModule.kt'),
  'utf8',
);
const helperKt = fs.readFileSync(
  path.join(androidSrc, 'java/com/anistockmobiletemplate/ApkInstallHelper.kt'),
  'utf8',
);
const receiverKt = fs.readFileSync(
  path.join(androidSrc, 'java/com/anistockmobiletemplate/ApkDownloadReceiver.kt'),
  'utf8',
);
const installResultKt = fs.readFileSync(
  path.join(androidSrc, 'java/com/anistockmobiletemplate/InstallResultReceiver.kt'),
  'utf8',
);

describe('APK in-app install native contract', () => {
  it('exposes FileProvider roots for cache and DownloadManager external-files destinations', () => {
    expect(filePathsXml).toMatch(/<cache-path\b/);
    expect(filePathsXml).toMatch(/<external-files-path\b[^>]*path="Download\/"/);
  });

  it('deletes a stale APK before DownloadManager enqueue so retries are not FILE_ALREADY_EXISTS', () => {
    expect(moduleKt).toMatch(/deleteStaleDownloads\(/);
    expect(helperKt).toMatch(/fun deleteStaleDownloads\(/);
    expect(moduleKt).toMatch(/setDestinationUri\(/);
  });

  it('installs from the downloaded file via PackageInstaller or FileProvider, not a chooser or DownloadManager URI', () => {
    expect(helperKt).toMatch(/PackageInstaller\.SessionParams/);
    expect(helperKt).toMatch(/FileProvider\.getUriForFile\(/);
    expect(helperKt).toMatch(/FLAG_GRANT_READ_URI_PERMISSION/);
    expect(helperKt).not.toMatch(/createChooser\(/);
    expect(receiverKt).toMatch(/existingInstallableApk\(/);
    expect(receiverKt).not.toMatch(/getUriForDownloadedFile\(/);
  });

  it('shows the system install confirmation when PackageInstaller reports pending user action', () => {
    expect(installResultKt).toMatch(/STATUS_PENDING_USER_ACTION/);
    expect(installResultKt).toMatch(/EXTRA_INTENT/);
    expect(helperKt).toMatch(/FLAG_MUTABLE/);
  });

  it('registers the download-complete receiver as exported so system DownloadManager broadcasts arrive on API 33+', () => {
    expect(moduleKt).toMatch(/RECEIVER_EXPORTED/);
    expect(moduleKt).toMatch(/watchDownload\(/);
  });
});
