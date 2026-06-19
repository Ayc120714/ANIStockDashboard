import React from 'react';
import {Navigate} from 'react-router-dom';
import useDeviceViewMode from '../hooks/useDeviceViewMode';
import StockAlertsPage from '../pages/StockAlertsPage';
import PremiumModuleRoute from './PremiumModuleRoute';

/** Phone app shell: web `/alerts` maps to Advisor → Signals; desktop keeps full alerts page. */
function StockAlertsRoute() {
  const viewMode = useDeviceViewMode();
  if (viewMode === 'app') {
    return <Navigate to="/advisor?advisorTab=signals" replace />;
  }
  return (
    <PremiumModuleRoute>
      <StockAlertsPage />
    </PremiumModuleRoute>
  );
}

export default StockAlertsRoute;
