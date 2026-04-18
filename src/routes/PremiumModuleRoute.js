import React from 'react';
import { Box, CircularProgress } from '@mui/material';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

/**
 * Wraps premium-only pages (Long Term, Short Term, Screens, Advisor, Portfolio Manager, Alerts, F&O, Commodities, Forex).
 * Uses the same access flag as Overview long-horizon columns: {@link useAuth}.outlookPremium
 * (backend `outlook_premium` from `/auth/me`, including DB premium allowlist when the paywall is on).
 */
function PremiumModuleRoute({ children }) {
  const { outlookPremium, bootstrapping } = useAuth();

  if (bootstrapping) {
    return (
      <Box sx={{ minHeight: 240, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!outlookPremium) {
    // Basic users: send them to the in-app upgrade / payment instructions page.
    return <Navigate to="/upgrade-premium" replace />;
  }

  return children;
}

export default PremiumModuleRoute;
