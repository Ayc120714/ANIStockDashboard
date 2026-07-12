import {STORAGE_KEYS, USER_SCOPED_ALERT_KEYS} from '@core/storage/keys';

describe('USER_SCOPED_ALERT_KEYS (logout hygiene)', () => {
  it('covers every per-user digest/inbox key so logout clears them', () => {
    expect(USER_SCOPED_ALERT_KEYS).toEqual(
      expect.arrayContaining([
        STORAGE_KEYS.signalsDigest,
        STORAGE_KEYS.liveAdvisorAlertsDigest,
        STORAGE_KEYS.pendingApprovalDigest,
        STORAGE_KEYS.notificationInboxDigest,
        STORAGE_KEYS.advisorTableDigests,
        STORAGE_KEYS.advisorTableChangeEvents,
        STORAGE_KEYS.notificationInboxSections,
      ]),
    );
  });

  it('never clears device-scoped keys (device id, update prompts, tokens handled elsewhere)', () => {
    expect(USER_SCOPED_ALERT_KEYS).not.toContain(STORAGE_KEYS.deviceId);
    expect(USER_SCOPED_ALERT_KEYS).not.toContain(STORAGE_KEYS.dismissedUpdateCode);
    expect(USER_SCOPED_ALERT_KEYS).not.toContain(STORAGE_KEYS.pendingAppUpdate);
  });
});
