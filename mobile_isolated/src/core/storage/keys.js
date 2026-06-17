export const STORAGE_KEYS = {
  accessToken: '@ani/mobile/access-token',
  refreshToken: '@ani/mobile/refresh-token',
  user: '@ani/mobile/user',
  deviceId: '@ani/mobile/device-id',
  otpFlow: '@ani/mobile/otp-flow',
  /** Last digest of advisor signals feed (in-app new-signal banner + tab badge). */
  signalsDigest: '@ani/mobile/signals-digest',
  /** Last digest of live advisor DB alerts (push during market hours). */
  liveAdvisorAlertsDigest: '@ani/mobile/live-advisor-alerts-digest',
  /** @deprecated use signalsDigest */
  entryReadyDigest: '@ani/mobile/entry-ready-digest',
  /** Pending approval user ids digest (super-admin registration alerts). */
  pendingApprovalDigest: '@ani/mobile/pending-approval-digest',
  /** Remote versionCode the user dismissed or already tried to install from the update popup. */
  dismissedUpdateCode: '@ani/mobile/dismissed-update-code',
  /** @deprecated migrated to notificationInboxReadKeys(userId) */
  notificationInboxDigest: '@ani/mobile/notification-inbox-digest',
  /** Per-table symbol digests for advisor/screens change detection. */
  advisorTableDigests: '@ani/mobile/advisor-table-digests',
  /** Persisted table-change notification events. */
  advisorTableChangeEvents: '@ani/mobile/advisor-table-change-events',
  /** Last rendered notification inbox sections for instant bell open. */
  notificationInboxSections: '@ani/mobile/notification-inbox-sections-v1',
};

/** Per-user read keys for the notification inbox (survives refresh / poll). */
export function notificationInboxReadKeys(userId = '') {
  const uid = String(userId || '').trim() || 'anon';
  return `@ani/mobile/notification-inbox-read-v2-${uid}`;
}
