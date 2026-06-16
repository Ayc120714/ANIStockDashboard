import fs from 'fs';
import path from 'path';
import {
  APP_VERSION_CODE,
  APP_VERSION_NAME,
} from '@core/config/appVersion';
import {isAppUpdateAvailable, isRemoteVersionNewer} from '@core/utils/appUpdateCheck';

const pkg = require('../package.json');
const gradlePath = path.join(__dirname, '../android/app/build.gradle');
const gradle = fs.readFileSync(gradlePath, 'utf8');
const gradleVersionCode = Number((gradle.match(/versionCode\s+(\d+)/) || [])[1]);
const gradleVersionName = (gradle.match(/versionName\s+"([^"]+)"/) || [])[1];

describe('app update check', () => {
  it('keeps appVersion.js in sync with package.json and build.gradle', () => {
    expect(APP_VERSION_NAME).toBe(pkg.version);
    expect(APP_VERSION_NAME).toBe(gradleVersionName);
    expect(APP_VERSION_CODE).toBe(gradleVersionCode);
  });

  it('detects newer remote versionCode', () => {
    expect(
      isAppUpdateAvailable({
        version: APP_VERSION_NAME,
        versionCode: APP_VERSION_CODE + 1,
      }),
    ).toBe(true);
  });

  it('does not prompt when remote is older than installed', () => {
    expect(
      isAppUpdateAvailable({
        version: '1.2.38',
        versionCode: 28,
      }),
    ).toBe(false);
  });

  it('compares semver when versionCode is missing', () => {
    const parts = String(APP_VERSION_NAME).split('.').map(n => parseInt(n, 10) || 0);
    const older = `${parts[0]}.${parts[1]}.${Math.max(0, parts[2] - 1)}`;
    const newer = `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
    expect(isRemoteVersionNewer(newer, APP_VERSION_NAME)).toBe(true);
    expect(isRemoteVersionNewer(older, APP_VERSION_NAME)).toBe(false);
  });
});
