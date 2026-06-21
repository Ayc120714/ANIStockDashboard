import React from 'react';
import LiveSetupsPage from '../pages/LiveSetupsPage';
import PremiumModuleRoute from './PremiumModuleRoute';

/** Live setup board: today + this week generated setups with trade actions. */
function StockAlertsRoute() {
  return (
    <PremiumModuleRoute>
      <LiveSetupsPage />
    </PremiumModuleRoute>
  );
}

export default StockAlertsRoute;
