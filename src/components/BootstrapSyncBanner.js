import React from 'react';
import { Alert, Box, LinearProgress } from '@mui/material';
import { useBootstrapReadyState } from '../context/BootstrapReadyContext';

/**
 * Shown after the API is reachable while backend startup bootstrap (Samco/candles) is still running.
 * Hides when /api/system/readiness → bootstrap_complete, or if API wait timed out.
 */
function BootstrapSyncBanner() {
  const { showData, bootstrapComplete, timedOut } = useBootstrapReadyState();

  if (!showData || timedOut || bootstrapComplete) {
    return null;
  }

  return (
    <Box sx={{ px: 2, pt: 1, flexShrink: 0 }} role="status" aria-live="polite">
      <Alert severity="info" sx={{ py: 0.75, alignItems: 'center' }}>
        <strong>Market data sync in progress.</strong>
        {' '}
        Screens and % values improve as EOD candles are saved. Refresh in a few minutes if numbers
        look stale — or wait until this bar disappears.
        <LinearProgress sx={{ mt: 1.25, borderRadius: 1 }} />
      </Alert>
    </Box>
  );
}

export default BootstrapSyncBanner;
