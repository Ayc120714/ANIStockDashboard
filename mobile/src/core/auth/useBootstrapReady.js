import {useCallback, useEffect, useState} from 'react';
import {dashboardService} from '@core/api/services/dashboardService';

export const useBootstrapReady = (intervalMs = 15000) => {
  const [ready, setReady] = useState(false);
  const [lastPayload, setLastPayload] = useState(null);

  const checkReady = useCallback(async () => {
    try {
      const payload = await dashboardService.fetchSystemReadiness();
      setLastPayload(payload);
      setReady(Boolean(payload?.ready || payload?.is_ready));
    } catch (_) {
      setReady(false);
    }
  }, []);

  useEffect(() => {
    checkReady();
    const id = setInterval(checkReady, intervalMs);
    return () => clearInterval(id);
  }, [checkReady, intervalMs]);

  return {ready, lastPayload, checkReady};
};
