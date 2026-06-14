export const STORAGE_KEYS = {
  accessToken: '@ani/mobile/access-token',
  refreshToken: '@ani/mobile/refresh-token',
  user: '@ani/mobile/user',
  deviceId: '@ani/mobile/device-id',
  otpFlow: '@ani/mobile/otp-flow',
  /** Last digest of advisor signals feed (in-app new-signal banner + tab badge). */
  signalsDigest: '@ani/mobile/signals-digest',
  /** @deprecated use signalsDigest */
  entryReadyDigest: '@ani/mobile/entry-ready-digest',
  /** Pending approval user ids digest (super-admin registration alerts). */
  pendingApprovalDigest: '@ani/mobile/pending-approval-digest',
  /** Remote versionCode the user dismissed or already tried to install from the update popup. */
  dismissedUpdateCode: '@ani/mobile/dismissed-update-code',
  /** Digest of notification inbox items the user has already seen. */
  notificationInboxDigest: '@ani/mobile/notification-inbox-digest',
  /** Per-table symbol digests for advisor/screens change detection. */
  advisorTableDigests: '@ani/mobile/advisor-table-digests',
  /** Persisted table-change notification events. */
  advisorTableChangeEvents: '@ani/mobile/advisor-table-change-events',
};
