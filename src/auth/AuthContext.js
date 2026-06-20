import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { configureAuthHandlers, clearApiGetCache } from '../api/apiClient';
import { fetchMe, logoutSession, refreshSession } from '../api/auth';
import { clearBrokerSession } from '../api/brokers';
import { resolveOutlookPremiumAccess } from '../utils/outlookPremiumAccess';
import { beginLogout, isLogoutActive, resetLogoutState } from './authSessionControl';

const ACCESS_KEY = 'auth_access_token';
const REFRESH_KEY = 'auth_refresh_token';
const USER_KEY = 'auth_user';
const LOGOUT_BROKERS = ['dhan', 'angelone', 'samco', 'upstox', 'kotak', 'fyers', 'zerodha'];
const DEFAULT_ADMIN_EMAILS = ['gvc1990@gmail.com', 'admin@aycindustries.com'];

const AuthContext = createContext(null);
const ADMIN_EMAILS = new Set(
  [
    ...DEFAULT_ADMIN_EMAILS,
    ...(process.env.REACT_APP_ADMIN_EMAILS || '').split(','),
  ]
    .map((v) => String(v).trim().toLowerCase())
    .filter(Boolean)
);

/** Admin Users + Telegram Admin routes only (not watchlist/order admin). */
const SUPER_ADMIN_EMAILS = new Set(
  [
    ...DEFAULT_ADMIN_EMAILS,
    ...(process.env.REACT_APP_SUPER_ADMIN_EMAILS || '').split(','),
  ]
    .map((v) => String(v).trim().toLowerCase())
    .filter(Boolean)
);

const clearLocalBrokerSessionMarkers = () => {
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith('broker_session_auth_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch (_) {
    // ignore localStorage access failures
  }
};

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(localStorage.getItem(ACCESS_KEY) || '');
  const [refreshToken, setRefreshToken] = useState(localStorage.getItem(REFRESH_KEY) || '');
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [bootstrapping, setBootstrapping] = useState(true);
  const authRunRef = useRef(0);

  const clearAuth = useCallback(() => {
    setAccessToken('');
    setRefreshToken('');
    setUser(null);
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    clearLocalBrokerSessionMarkers();
  }, []);

  const persistAuth = useCallback((nextAccess, nextRefresh, nextUser = null) => {
    setAccessToken(nextAccess || '');
    setRefreshToken(nextRefresh || '');
    if (nextUser) {
      setUser(nextUser);
      localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    }
    if (nextAccess) localStorage.setItem(ACCESS_KEY, nextAccess);
    if (nextRefresh) localStorage.setItem(REFRESH_KEY, nextRefresh);
  }, []);

  const hydrateMe = useCallback(async () => {
    if (isLogoutActive()) return;
    // After login, tokens are written to localStorage before React state updates; read storage so
    // /auth/me still runs (avoids treating user as basic/premium from stale partial login payloads).
    const token =
      accessToken || (typeof localStorage !== 'undefined' ? localStorage.getItem(ACCESS_KEY) || '' : '');
    if (!token || isLogoutActive()) return;
    try {
      const data = await fetchMe();
      if (isLogoutActive()) return;
      if (data?.user) {
        setUser(data.user);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      }
    } catch (_) {
      // handled by unauthorized callback / refresh flow
    }
  }, [accessToken]);

  const tryRefresh = useCallback(async () => {
    if (isLogoutActive()) return false;
    if (!refreshToken) {
      clearAuth();
      return false;
    }
    try {
      const data = await refreshSession(refreshToken);
      if (isLogoutActive()) return false;
      if (!data?.access_token || !data?.refresh_token) {
        clearAuth();
        return false;
      }
      persistAuth(data.access_token, data.refresh_token);
      return true;
    } catch (_) {
      clearAuth();
      return false;
    }
  }, [clearAuth, persistAuth, refreshToken]);

  useEffect(() => {
    configureAuthHandlers({
      getAccessToken: () => (isLogoutActive() ? '' : localStorage.getItem(ACCESS_KEY) || ''),
      onUnauthorized: () => (isLogoutActive() ? false : tryRefresh()),
    });
  }, [tryRefresh]);

  useEffect(() => {
    let mounted = true;
    const runId = authRunRef.current;
    (async () => {
      if (isLogoutActive()) return;
      if (!accessToken && !refreshToken) {
        if (mounted) setBootstrapping(false);
        return;
      }
      if (accessToken) {
        await hydrateMe();
      } else {
        await tryRefresh();
      }
      if (mounted && authRunRef.current === runId && !isLogoutActive()) {
        setBootstrapping(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [accessToken, refreshToken, hydrateMe, tryRefresh]);

  // Re-fetch /auth/me so paid-premium expiry updates outlook_premium without a full reload (paywall on).
  useEffect(() => {
    if (!accessToken || isLogoutActive()) return undefined;
    const tick = () => {
      if (!isLogoutActive()) hydrateMe();
    };
    const id = window.setInterval(tick, 120000);
    return () => window.clearInterval(id);
  }, [accessToken, hydrateMe]);

  useEffect(() => {
    if (!accessToken || isLogoutActive()) return undefined;
    const onVis = () => {
      if (document.visibilityState === 'visible' && !isLogoutActive()) hydrateMe();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [accessToken, hydrateMe]);

  const logout = useCallback(() => {
    if (isLogoutActive()) return;

    beginLogout();
    authRunRef.current += 1;

    const capturedRefresh = refreshToken || localStorage.getItem(REFRESH_KEY) || '';
    const capturedUserId = String(user?.id || user?.user_id || user?.email || '');

    if (capturedUserId) {
      LOGOUT_BROKERS.forEach((broker) => {
        void clearBrokerSession({ user_id: capturedUserId, broker }).catch(() => {});
      });
    }

    clearAuth();
    clearApiGetCache();
    setBootstrapping(false);
    resetLogoutState();

    if (capturedRefresh) {
      void logoutSession(capturedRefresh).catch(() => {});
    }
  }, [clearAuth, refreshToken, user]);

  const outlookPremium = useMemo(() => resolveOutlookPremiumAccess(user), [user]);

  const value = useMemo(
    () => ({
      user,
      accessToken,
      refreshToken,
      isAuthenticated: Boolean(accessToken && user),
      isAdmin: Boolean(user?.is_admin) || ADMIN_EMAILS.has(String(user?.email || '').toLowerCase()),
      isSuperAdmin:
        Boolean(user?.is_super_admin) ||
        SUPER_ADMIN_EMAILS.has(String(user?.email || '').toLowerCase()),
      outlookPremium,
      bootstrapping,
      persistAuth,
      clearAuth,
      logout,
      hydrateMe,
    }),
    [user, accessToken, refreshToken, bootstrapping, outlookPremium, persistAuth, clearAuth, logout, hydrateMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
