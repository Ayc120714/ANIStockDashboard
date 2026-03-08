import { fetchBrokerSetup } from '../api/brokers';

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

const hasAnyBrokerSession = (rows) => (rows || []).some((r) => Boolean(
  r?.has_session
  || r?.hasSession
  || r?.session_active
  || r?.sessionActive
  || r?.session_token
  || r?.last_auth_at
));

const hasDhanSetup = (rows) => {
  const dhanRow = (rows || []).find((r) => String(r?.broker || '').toLowerCase() === 'dhan');
  if (!dhanRow) return false;
  return Boolean(
    String(dhanRow?.client_id || '').trim()
    || dhanRow?.is_enabled
    || dhanRow?.has_session
  );
};

const hasLocalDhanDraft = (userId) => {
  if (!userId) return false;
  try {
    const raw = localStorage.getItem(`broker_integration_draft_${userId}_dhan`);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    const client = String(parsed?.client_id || parsed?.credentials?.mobile || '').trim();
    const key = String(parsed?.credentials?.api_key || '').trim();
    const secret = String(parsed?.credentials?.api_secret || '').trim();
    return Boolean(client || (key && secret));
  } catch (_) {
    return false;
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

  try {
    const rows = await fetchBrokerSetup({ userId });
    const list = Array.isArray(rows) ? rows : [];
    if (hasAnyBrokerSession(list) || hasDhanSetup(list) || hasLocalDhanDraft(userId)) {
      navigate(`/callback?from=${encodeURIComponent(fallback)}`, { replace: true });
      return;
    }
    navigate('/profile', { replace: true, state: { openBrokerSetup: true, from: fallback } });
  } catch (_) {
    // Trade API may be temporarily unavailable. Still try callback flow first.
    navigate(`/callback?from=${encodeURIComponent(fallback)}`, { replace: true });
  }
};
