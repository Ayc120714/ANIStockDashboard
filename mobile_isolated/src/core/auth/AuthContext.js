import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {configureAuthHandlers} from '@core/api/apiClient';
import {authService} from '@core/api/services/authService';
import {dashboardService} from '@core/api/services/dashboardService';
import {sessionStorage} from '@core/storage/sessionStorage';
import {tokenStorage} from '@core/storage/tokenStorage';

const AuthContext = createContext(null);

export const AuthProvider = ({children}) => {
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [tokens, setTokens] = useState({accessToken: null, refreshToken: null});

  const refreshAccessToken = useCallback(async () => {
    const refreshToken = await tokenStorage.getRefreshToken();
    if (!refreshToken) return null;
    const session = await authService.refreshSession(refreshToken);
    const nextTokens = {
      accessToken: session?.access_token || session?.accessToken || null,
      refreshToken: session?.refresh_token || refreshToken,
    };
    await tokenStorage.saveTokens(nextTokens);
    setTokens(nextTokens);
    return nextTokens.accessToken;
  }, []);

  const logout = useCallback(async () => {
    try {
      const refreshToken = await tokenStorage.getRefreshToken();
      if (refreshToken) {
        await authService.logoutSession(refreshToken);
      }
    } catch (_) {
      // Ignore network/logout failures during local sign out.
    } finally {
      await sessionStorage.clear();
      setIsAuthenticated(false);
      setUser(null);
      setTokens({accessToken: null, refreshToken: null});
    }
  }, []);

  const loginWithSession = useCallback(async session => {
    const nextTokens = {
      accessToken: session?.access_token || session?.accessToken || null,
      refreshToken: session?.refresh_token || session?.refreshToken || null,
    };
    await tokenStorage.saveTokens(nextTokens);
    setTokens(nextTokens);
    const me = await authService.fetchMe();
    setUser(me);
    await sessionStorage.saveUser(me);
    setIsAuthenticated(true);
  }, []);

  useEffect(() => {
    configureAuthHandlers({
      getAccessToken: async () => tokenStorage.getAccessToken(),
      onUnauthorized: async () => {
        try {
          await refreshAccessToken();
        } catch (_) {
          await logout();
        }
      },
    });
  }, [logout, refreshAccessToken]);

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      try {
        const [storedUser, accessToken, refreshToken] = await Promise.all([
          sessionStorage.getUser(),
          tokenStorage.getAccessToken(),
          tokenStorage.getRefreshToken(),
        ]);
        if (!mounted) return;
        if (storedUser) {
          setUser(storedUser);
        }
        if (accessToken || refreshToken) {
          setTokens({accessToken, refreshToken});
          const me = await authService.fetchMe();
          if (!mounted) return;
          setUser(me);
          setIsAuthenticated(true);
          await sessionStorage.saveUser(me);
        }
      } catch (_) {
        if (mounted) {
          await logout();
        }
      } finally {
        if (mounted) {
          setIsBootstrapping(false);
        }
      }
    };
    bootstrap();
    return () => {
      mounted = false;
    };
  }, [logout]);

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
