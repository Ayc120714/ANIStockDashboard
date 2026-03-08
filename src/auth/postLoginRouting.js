export const DHAN_DAILY_CONSENT_LIMIT = 25;
export const consentBlockKeyForToday = (userId) =>
  `dhan_consent_blocked_${String(userId || '')}_${new Date().toISOString().slice(0, 10)}`;
const consentBlockGlobalKeyForToday = () =>
  `dhan_consent_blocked_global_${new Date().toISOString().slice(0, 10)}`;

export const shouldSkipBrokerConsentToday = (userId) => {
  try {
    if (userId && localStorage.getItem(consentBlockKeyForToday(userId)) === '1') return true;
    if (localStorage.getItem(consentBlockGlobalKeyForToday()) === '1') return true;
    return false;
  } catch (_) {
    return false;
  }
};

export const markConsentLimitForToday = (userId) => {
  try {
    if (userId) localStorage.setItem(consentBlockKeyForToday(userId), '1');
    localStorage.setItem(consentBlockGlobalKeyForToday(), '1');
  } catch (_) {
    // ignore storage failures
  }
};

export const hasAnyConsentLimitMarkerToday = () => {
  const today = new Date().toISOString().slice(0, 10);
  try {
    if (localStorage.getItem(consentBlockGlobalKeyForToday()) === '1') return true;
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith('dhan_consent_blocked_') && key.endsWith(`_${today}`) && localStorage.getItem(key) === '1') {
        return true;
      }
    }
  } catch (_) {
    return false;
  }
  return false;
};

export const clearConsentLimitMarkersToday = () => {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const toDelete = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith('dhan_consent_blocked_') && key.endsWith(`_${today}`)) {
        toDelete.push(key);
      }
    }
    toDelete.forEach((k) => localStorage.removeItem(k));
  } catch (_) {
    // ignore storage failures
  }
};

export const routeAfterLogin = async ({ nextUser, fallbackPath = '/', navigate }) => {
  const fallback = fallbackPath || '/';
  const userId = String(nextUser?.id || nextUser?.user_id || nextUser?.email || '');
  if (!userId) {
    navigate(fallback, { replace: true });
    return;
  }

  if (shouldSkipBrokerConsentToday(userId)) {
    navigate(fallback, { replace: true, state: { brokerConsentLimited: true } });
    return;
  }

  // Strict flow: after email login, always enter Dhan callback consent flow.
  // Callback page will reuse active session, or generate consent URL using
  // existing backend env credentials (client_id/api_key/api_secret).
  navigate(`/callback?from=${encodeURIComponent(fallback)}`, { replace: true });
};
