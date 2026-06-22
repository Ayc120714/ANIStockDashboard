import React, {useEffect, useRef} from 'react';
import {
  bootstrapCriticalDashboard,
  startAppShellAutoRefresh,
  stopAppShellAutoRefresh,
  warmAppShellInBackground,
} from '@core/bootstrap/bootstrapAppShellData';
import {registerMobileInstall} from '@core/api/services/mobileService';
import {prefetchAppShellData} from '@core/bootstrap/prefetchAppShellData';
import {readPageCache} from '@core/storage/pageCache';
import {MOBILE_PAGE_CACHE_KEYS} from '@core/utils/dashboardCachePolicy';
import {readDashboardCache} from '@core/storage/dashboardCache';
import {AycSplashScreen} from '@components/AycSplashScreen';

/**
 * Opens the main app as soon as cached shell data exists.
 * Network bootstrap runs in the background — never blocks the UI on API latency.
 */
export function AppStartupLoader({onReady}) {
  const refreshStartedRef = useRef(false);
  const readyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const finishStartup = () => {
      if (cancelled || readyRef.current) return;
      readyRef.current = true;
      registerMobileInstall().catch(() => {});
      // Tab screens load on demand from cache — avoid startup warm stampeding the API gate.
      startAppShellAutoRefresh();
      refreshStartedRef.current = true;
      onReady?.();
    };

    (async () => {
      await Promise.all([
        readPageCache(MOBILE_PAGE_CACHE_KEYS.dashboard),
        readDashboardCache(),
      ]);
      if (cancelled) return;

      // Never block the UI on network — tabs hydrate from cache and refresh in background.
      finishStartup();
      bootstrapCriticalDashboard()
        .catch(() => {})
        .finally(() => {
          if (cancelled) return;
          prefetchAppShellData().catch(() => {});
          warmAppShellInBackground().catch(() => {});
        });
    })();

    return () => {
      cancelled = true;
      if (!refreshStartedRef.current) {
        stopAppShellAutoRefresh();
      }
    };
  }, [onReady]);

  return <AycSplashScreen />;
}
