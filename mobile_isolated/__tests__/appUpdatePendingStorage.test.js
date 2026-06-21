import {
  clearPendingAppUpdate,
  loadPendingAppUpdate,
  normalizePendingAppUpdate,
  savePendingAppUpdate,
} from '@core/utils/appUpdatePendingStorage';

describe('appUpdatePendingStorage', () => {
  it('normalizes pending update payloads', () => {
    expect(
      normalizePendingAppUpdate({
        apkUrl: 'https://example.com/app.apk',
        remoteCode: 52,
        version: '1.2.68',
      }),
    ).toEqual({
      apkUrl: 'https://example.com/app.apk',
      remoteCode: 52,
      version: '1.2.68',
    });
    expect(normalizePendingAppUpdate({apkUrl: '', remoteCode: 52})).toBeNull();
  });

  it('persists and clears pending updates', async () => {
    const pending = {
      apkUrl: 'https://example.com/app.apk',
      remoteCode: 53,
      version: '1.2.69',
    };
    await savePendingAppUpdate(pending);
    await expect(loadPendingAppUpdate()).resolves.toEqual(pending);
    await clearPendingAppUpdate();
    await expect(loadPendingAppUpdate()).resolves.toBeNull();
  });
});
