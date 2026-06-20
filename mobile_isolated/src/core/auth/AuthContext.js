import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {configureAuthHandlers} from '@core/api/apiClient';
import {authService} from '@core/api/services/authService';
import {dashboardService} from '@core/api/services/dashboardService';
import {stopAppShellAutoRefresh} from '@core/bootstrap/bootstrapAppShellData';
import {env} from '@core/config/env';
import {beginLogout, isLogoutActive, resetLogoutState} from '@core/auth/authSessionControl';
import {sessionStorage} from '@core/storage/sessionStorage';
import {tokenStorage} from '@core/storage/tokenStorage';
import {clearAllSessionPageCaches} from '@core/storage/pageCache';

const isLocalDevToken = token =>
  typeof token === 'string' && /^local-(access|refresh)-/.test(token);

const AuthContext = createContext(null);

export const AuthProvider = ({children}) => {
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [tokens, setTokens] = useState({accessToken: null, refreshToken: null});
  const bootstrapRunRef = useRef(0);

  const refreshAccessToken = useCallback(async () => {
    if (isLogoutActive()) return null;
    const refreshToken = await tokenStorage.getRefreshToken();
    if (!refreshToken || isLogoutActive()) return null;
    const session = await authService.refreshSession(refreshToken);
    if (isLogoutActive()) return null;
    const nextTokens = {
      accessToken: session?.access_token || session?.accessToken || null,
      refreshToken: session?.refresh_token || refreshToken,
    };
    await tokenStorage.saveTokens(nextTokens);
    if (isLogoutActive()) return null;
    setTokens(nextTokens);
    return nextTokens.accessToken;
  }, []);

  const clearLocalSession = useCallback(async () => {
    bootstrapRunRef.current += 1;
    resetLogoutState();
    setIsAuthenticated(false);
    setUser(null);
    setTokens({accessToken: null, refreshToken: null});
    try {
      await sessionStorage.clear();
    } catch (_) {
      /* ignore */
    }
  }, []);

  const logout = useCallback(() => {
    beginLogout();
    stopAppShellAutoRefresh();
    bootstrapRunRef.current += 1;

    setIsAuthenticated(false);
    setUser(null);
    setTokens({accessToken: null, refreshToken: null});
    setIsBootstrapping(false);
    resetLogoutState();

    void (async () => {
      await clearAllSessionPageCaches();
      let refreshToken = null;
      try {
        refreshToken = await tokenStorage.getRefreshToken();
      } catch (_) {
        /* local clear still proceeds */
      }
      try {
        await sessionStorage.clear();
      } catch (_) {
        /* ignore */
      }
      if (refreshToken && !env.localAuthMode) {
        try {
          await authService.logoutSession(refreshToken);
        } catch (_) {
          /* server revoke is best-effort */
        }
      }
    })();
  }, []);

  const loginWithSession = useCallback(async session => {
    resetLogoutState();
    const nextTokens = {
      accessToken: session?.access_token || session?.accessToken || null,
      refreshToken: session?.refresh_token || session?.refreshToken || null,
    };
    await tokenStorage.saveTokens(nextTokens);
    setTokens(nextTokens);
    const me = await authService.fetchMe();
    if (isLogoutActive()) return;
    setUser(me);
    await sessionStorage.saveUser(me);
    setIsAuthenticated(true);
  }, []);

  useEffect(() => {
    configureAuthHandlers({
      getAccessToken: async () => {
        if (isLogoutActive()) return null;
        return tokenStorage.getAccessToken();
      },
      onUnauthorized: async () => {
        if (isLogoutActive()) return null;
        try {
          return await refreshAccessToken();
        } catch (_) {
          logout();
          return null;
        }
      },
    });
  }, [logout, refreshAccessToken]);

  useEffect(() => {
    let mounted = true;
    const runId = bootstrapRunRef.current + 1;
    bootstrapRunRef.current = runId;

    const bootstrap = async () => {
      try {
        const [storedUser, accessToken, refreshToken] = await Promise.all([
          sessionStorage.getUser(),
          tokenStorage.getAccessToken(),
          tokenStorage.getRefreshToken(),
        ]);
        if (!mounted || isLogoutActive() || bootstrapRunRef.current !== runId) return;
        if (storedUser) {
          setUser(storedUser);
        }
        if (accessToken || refreshToken) {
          if ((isLocalDevToken(accessToken) || isLocalDevToken(refreshToken)) && !env.localAuthMode) {
            logout();
            return;
          }
          setTokens({accessToken, refreshToken});
          setIsAuthenticated(true);
          if (mounted) {
            setIsBootstrapping(false);
          }
          try {
            const me = await authService.fetchMe({timeoutMs: 8000});
            if (!mounted || isLogoutActive() || bootstrapRunRef.current !== runId) return;
            setUser(me);
            await sessionStorage.saveUser(me);
          } catch (_) {
            if (mounted && !storedUser) {
              await clearLocalSession();
            }
          }
          return;
        }
      } catch (_) {
        if (mounted) {
          await clearLocalSession();
        }
      } finally {
        if (mounted && !isLogoutActive()) {
          setIsBootstrapping(false);
        }
      }
    };
    bootstrap();
    return () => {
      mounted = false;
    };
  }, [clearLocalSession, logout]);

  const checkBootstrapReadiness = useCallback(() => dashboardService.fetchSystemReadiness(), []);

  const value = useMemo(
    () => ({
      isBootstrapping,
      isAuthenticated,
      user,
      tokens,
      loginWithSession,
      logout,
      refreshAccessToken,
      checkBootstrapReadiness,
    }),
    [checkBootstrapReadiness, isAuthenticated, isBootstrapping, loginWithSession, logout, refreshAccessToken, tokens, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
};
