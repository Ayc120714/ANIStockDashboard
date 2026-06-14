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
};
