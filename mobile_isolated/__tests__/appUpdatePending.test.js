import AsyncStorage from '@react-native-async-storage/async-storage';
import {STORAGE_KEYS} from '@core/storage/keys';
import {
  isPendingUpdateSatisfied,
  reconcilePendingAppUpdate,
  shouldAutoResumePendingUpdate,
} from '@core/utils/appUpdatePending';
import {
  clearPendingAppUpdate,
  savePendingAppUpdate,
} from '@core/utils/appUpdatePendingStorage';

describe('appUpdatePending', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('auto-resumes only when permission is granted and no update is running', () => {
    const pending = {apkUrl: 'https://example.com/app.apk', remoteCode: 52};

    expect(
      shouldAutoResumePendingUpdate({
        pendingUpdate: pending,
        canInstall: true,
        updating: false,
        installedVersionCode: 51,
      }),
    ).toBe(true);
    expect(
      shouldAutoResumePendingUpdate({
        pendingUpdate: pending,
        canInstall: false,
        updating: false,
        installedVersionCode: 51,
      }),
    ).toBe(false);
    expect(
      shouldAutoResumePendingUpdate({
        pendingUpdate: pending,
        canInstall: true,
        updating: true,
        installedVersionCode: 51,
      }),
    ).toBe(false);
    expect(
      shouldAutoResumePendingUpdate({
        pendingUpdate: null,
        canInstall: true,
        updating: false,
        installedVersionCode: 51,
      }),
    ).toBe(false);
  });

  it('does not auto-resume after the pending version is already installed', () => {
    const pending = {apkUrl: 'https://example.com/app.apk', remoteCode: 52};

    expect(isPendingUpdateSatisfied(pending, 52)).toBe(true);
    expect(isPendingUpdateSatisfied(pending, 53)).toBe(true);
    expect(isPendingUpdateSatisfied(pending, 51)).toBe(false);

    expect(
      shouldAutoResumePendingUpdate({
        pendingUpdate: pending,
        canInstall: true,
        updating: false,
        installedVersionCode: 52,
      }),
    ).toBe(false);
  });

  it('clears stale pending update after install so the same APK is not re-downloaded', async () => {
    await savePendingAppUpdate({
      apkUrl: 'https://example.com/app.apk',
      remoteCode: 57,
      version: '1.2.72',
    });

    const pending = await reconcilePendingAppUpdate(57);

    expect(pending).toBeNull();
    expect(await AsyncStorage.getItem(STORAGE_KEYS.pendingAppUpdate)).toBeNull();
    expect(await AsyncStorage.getItem(STORAGE_KEYS.dismissedUpdateCode)).toBe('57');
  });

  it('keeps pending update when installed build is still older', async () => {
    await savePendingAppUpdate({
      apkUrl: 'https://example.com/app.apk',
      remoteCode: 58,
      version: '1.2.73',
    });

    const pending = await reconcilePendingAppUpdate(57);

    expect(pending).toEqual({
      apkUrl: 'https://example.com/app.apk',
      remoteCode: 58,
      version: '1.2.73',
    });

    await clearPendingAppUpdate();
  });
});
