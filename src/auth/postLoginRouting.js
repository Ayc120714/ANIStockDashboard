import { fetchBrokerSetup, hasAnyBrokerLiveSession } from '../api/brokers';

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

  let pendingDhanLogin = false;
  try {
    const raw = sessionStorage.getItem(`dhan_pending_connect_${userId}`);
    const p = raw ? JSON.parse(raw) : {};
    const url = String(p?.login_url || '').trim();
    const createdAt = Number(p?.created_at || 0);
    pendingDhanLogin = Boolean(url && (!createdAt || (Date.now() - createdAt) < 30 * 60 * 1000));
  } catch (_) {
    pendingDhanLogin = false;
  }

  if (pendingDhanLogin) {
    let preferredBroker = '';
    try {
      preferredBroker = String(localStorage.getItem(`broker_preferred_${userId}`) || '').trim().toLowerCase();
    } catch (_) {
      preferredBroker = '';
    }
    if (preferredBroker && preferredBroker !== 'dhan') {
      try {
        sessionStorage.removeItem(`dhan_pending_connect_${userId}`);
      } catch (_) {
        // ignore storage failures
      }
    } else {
      navigate(`/callback?from=${encodeURIComponent(fallback)}`, { replace: true });
      return;
    }
  }

  try {
    const rows = await fetchBrokerSetup({ userId });
    if (hasAnyBrokerLiveSession(rows)) {
      navigate(fallback, { replace: true });
      return;
    }
    // Read broker drafts once so we can route by a single broker intent.
    const readDraft = (broker) => {
      try {
        return JSON.parse(localStorage.getItem(`broker_integration_draft_${userId}_${broker}`) || '{}');
      } catch (_) {
        return {};
      }
    };
    const readPreferredBroker = () => {
      try {
        const raw = String(localStorage.getItem(`broker_preferred_${userId}`) || '').trim().toLowerCase();
        if (['dhan', 'angelone', 'samco', 'upstox', 'kotak', 'fyers', 'zerodha'].includes(raw)) return raw;
      } catch (_) {
        // ignore storage failures
      }
      return '';
    };
    const nonEmpty = (...vals) => vals.some((v) => String(v || '').trim().length > 0);
    const rowByBroker = new Map((Array.isArray(rows) ? rows : []).map((r) => [String(r?.broker || '').toLowerCase(), r]));
    const hasIntentFor = (broker) => {
      const row = rowByBroker.get(broker);
      const draft = readDraft(broker);
      const cred = draft?.credentials && typeof draft.credentials === 'object' ? draft.credentials : {};
      const hasDraftIntent = nonEmpty(
        draft?.client_id,
        cred?.api_key,
        cred?.api_secret,
        cred?.pin,
        cred?.totp,
        cred?.token_id,
        cred?.access_token,
        cred?.auth_code,
        cred?.client_secret,
        cred?.redirect_uri
      );
      const hasRowIntent = Boolean(row && (row.is_enabled || row.token_stored || row.client_id));
      return hasDraftIntent || hasRowIntent;
    };

    const intentOrder = ['angelone', 'samco', 'upstox', 'kotak', 'fyers', 'zerodha', 'dhan'];
    const intentBrokers = intentOrder.filter((b) => hasIntentFor(b));
    const preferredBroker = readPreferredBroker();
    const chosenBroker = intentBrokers.includes(preferredBroker)
      ? preferredBroker
      : (intentBrokers.length === 1 ? intentBrokers[0] : intentBrokers[0]);

    if (chosenBroker) {
      // Enforce broker-specific flow: open the exact broker setup first.
      // API authentication should happen only for the broker user selected/filled.
      navigate('/profile', {
        replace: true,
        state: { openBrokerSetup: true, from: fallback, preferredBroker: chosenBroker },
      });
      return;
    }
  } catch (_) {
    navigate(fallback, { replace: true });
    return;
  }

  const isAdminUser = Boolean(nextUser?.is_admin);
  if (!isAdminUser) {
    navigate('/profile', { replace: true, state: { openBrokerSetup: true, from: fallback } });
    return;
  }
  navigate(fallback, { replace: true });
};
