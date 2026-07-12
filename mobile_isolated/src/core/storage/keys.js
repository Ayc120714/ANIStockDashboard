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
  /** Remote versionCode the user dismissed from the update popup ("Later"). */
  dismissedUpdateCode: '@ani/mobile/dismissed-update-code',
  /** In-flight update waiting for install permission or system install confirmation. */
  pendingAppUpdate: '@ani/mobile/pending-app-update',
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

/**
 * Alert/digest state that belongs to the signed-in user, not the device.
 * Cleared on logout so the next account doesn't inherit inbox rows or
 * suppressed-alert digests. Device-scoped keys (deviceId, update prompts)
 * intentionally stay.
 */
export const USER_SCOPED_ALERT_KEYS = [
  STORAGE_KEYS.signalsDigest,
  STORAGE_KEYS.liveAdvisorAlertsDigest,
  STORAGE_KEYS.entryReadyDigest,
  STORAGE_KEYS.pendingApprovalDigest,
  STORAGE_KEYS.notificationInboxDigest,
  STORAGE_KEYS.advisorTableDigests,
  STORAGE_KEYS.advisorTableChangeEvents,
  STORAGE_KEYS.notificationInboxSections,
];
