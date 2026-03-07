import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { configureAuthHandlers } from '../api/apiClient';
import { fetchMe, logoutSession, refreshSession } from '../api/auth';
import { clearBrokerSession } from '../api/brokers';

const ACCESS_KEY = 'auth_access_token';
const REFRESH_KEY = 'auth_refresh_token';
const USER_KEY = 'auth_user';
const DEFAULT_ADMIN_EMAILS = ['gvc1990@gmail.com'];

const AuthContext = createContext(null);
const ADMIN_EMAILS = new Set(
  [
    ...DEFAULT_ADMIN_EMAILS,
    ...(process.env.REACT_APP_ADMIN_EMAILS || '').split(','),
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
    if (!accessToken) return;
    try {
      const data = await fetchMe();
      if (data?.user) {
        setUser(data.user);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      }
    } catch (_) {
      // handled by unauthorized callback / refresh flow
    }
  }, [accessToken]);

  const tryRefresh = useCallback(async () => {
    if (!refreshToken) {
      clearAuth();
      return false;
    }
    try {
      const data = await refreshSession(refreshToken);
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
      getAccessToken: () => localStorage.getItem(ACCESS_KEY) || '',
      onUnauthorized: async () => {
        await tryRefresh();
      },
    });
  }, [tryRefresh]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!accessToken && !refreshToken) {
        if (mounted) setBootstrapping(false);
        return;
      }
      if (accessToken) {
        await hydrateMe();
      } else {
        await tryRefresh();
      }
      if (mounted) setBootstrapping(false);
    })();
    return () => {
      mounted = false;
    };
  }, [accessToken, refreshToken, hydrateMe, tryRefresh]);

  const logout = useCallback(async () => {
    const userId = String(user?.id || user?.user_id || user?.email || '');
    try {
      if (refreshToken) {
        await logoutSession(refreshToken);
      }
    } catch (_) {
      // noop
    }
    try {
      if (userId) {
        await clearBrokerSession({ user_id: userId });
      }
    } catch (_) {
      // noop
    }
    clearAuth();
  }, [clearAuth, refreshToken, user]);

  const value = useMemo(
    () => ({
      user,
      accessToken,
      refreshToken,
      isAuthenticated: Boolean(accessToken && user),
      isAdmin: Boolean(user?.is_admin) || ADMIN_EMAILS.has(String(user?.email || '').toLowerCase()),
      bootstrapping,
      persistAuth,
      clearAuth,
      logout,
      hydrateMe,
    }),
    [user, accessToken, refreshToken, bootstrapping, persistAuth, clearAuth, logout, hydrateMe]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
