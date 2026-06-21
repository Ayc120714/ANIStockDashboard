import {shouldAutoResumePendingUpdate} from '@core/utils/appUpdatePending';

describe('appUpdatePending', () => {
  it('auto-resumes only when permission is granted and no update is running', () => {
    const pending = {apkUrl: 'https://example.com/app.apk', remoteCode: 52};

    expect(
      shouldAutoResumePendingUpdate({pendingUpdate: pending, canInstall: true, updating: false}),
    ).toBe(true);
    expect(
      shouldAutoResumePendingUpdate({pendingUpdate: pending, canInstall: false, updating: false}),
    ).toBe(false);
    expect(
      shouldAutoResumePendingUpdate({pendingUpdate: pending, canInstall: true, updating: true}),
    ).toBe(false);
    expect(
      shouldAutoResumePendingUpdate({pendingUpdate: null, canInstall: true, updating: false}),
    ).toBe(false);
  });
});
