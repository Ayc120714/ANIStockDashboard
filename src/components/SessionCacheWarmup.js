import { useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { prefetchAppShellData } from '../bootstrap/prefetchAppShellData';

/** Warms session page caches in the background while the user navigates the app shell. */
export function SessionCacheWarmup() {
  const { isAuthenticated, bootstrapping, user } = useAuth();
  const userKey = String(user?.id || user?.user_id || user?.email || '');

  useEffect(() => {
    if (bootstrapping || !isAuthenticated) return undefined;
    void prefetchAppShellData({ userKey });
    return undefined;
  }, [isAuthenticated, bootstrapping, userKey]);

  return null;
}

export default SessionCacheWarmup;
