import React from 'react';
import StockAlertsPage from '../pages/StockAlertsPage';
import PremiumModuleRoute from './PremiumModuleRoute';

function StockAlertsRoute() {
  return (
    <PremiumModuleRoute>
      <StockAlertsPage />
    </PremiumModuleRoute>
  );
}

export default StockAlertsRoute;
