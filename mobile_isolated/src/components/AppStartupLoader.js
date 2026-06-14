import React, {useEffect, useRef} from 'react';
import {
  bootstrapCriticalDashboard,
  startAppShellAutoRefresh,
  startSignalsWarm,
  stopAppShellAutoRefresh,
  warmAppShellInBackground,
} from '@core/bootstrap/bootstrapAppShellData';
import {registerMobileInstall} from '@core/api/services/mobileService';
import {AycSplashScreen} from '@components/AycSplashScreen';

const RETRY_MS = 3000;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Blocks the main app until dashboard-critical data is ready.
 * Shows only the AYC blue brand splash — no status text or partial UI.
 */
export function AppStartupLoader({onReady}) {
  const refreshStartedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      while (!cancelled) {
        try {
          startSignalsWarm().catch(() => {});
          await bootstrapCriticalDashboard();
          if (cancelled) return;
          registerMobileInstall().catch(() => {});
          warmAppShellInBackground().catch(() => {});
          startAppShellAutoRefresh();
          refreshStartedRef.current = true;
          onReady?.();
          return;
        } catch {
          if (cancelled) return;
          await sleep(RETRY_MS);
        }
      }
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
