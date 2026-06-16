import {
  APP_VERSION_CODE,
  APP_VERSION_NAME,
} from '@core/config/appVersion';
import {isAppUpdateAvailable, isRemoteVersionNewer} from '@core/utils/appUpdateCheck';

describe('app update check', () => {
  it('uses synced installed version constants', () => {
    expect(APP_VERSION_NAME).toBe('1.2.52');
    expect(APP_VERSION_CODE).toBe(37);
  });

  it('detects newer remote versionCode', () => {
    expect(
      isAppUpdateAvailable({
        version: '1.2.52',
        versionCode: 38,
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
    expect(isRemoteVersionNewer('1.2.52', '1.2.51')).toBe(true);
    expect(isRemoteVersionNewer('1.2.49', '1.2.50')).toBe(false);
  });
});
