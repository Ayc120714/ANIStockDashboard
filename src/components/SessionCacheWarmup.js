import { useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { prefetchAppShellData } from '../bootstrap/prefetchAppShellData';

/** Warms session page caches in the background while the user navigates the app shell. */
export function SessionCacheWarmup() {
  const { isAuthenticated, bootstrapping } = useAuth();

  useEffect(() => {
    if (bootstrapping || !isAuthenticated) return undefined;
    void prefetchAppShellData();
    return undefined;
  }, [isAuthenticated, bootstrapping]);

  return null;
}

export default SessionCacheWarmup;
