import React from 'react';
import useDeviceViewMode from '../hooks/useDeviceViewMode';
import MainLayout from './MainLayout';
import MobileAppLayout from './MobileAppLayout';

/** Phone browsers → app-style shell; tablet & desktop → sidebar desktop layout. */
function AdaptiveMainLayout() {
  const viewMode = useDeviceViewMode();
  if (viewMode === 'app') {
    return <MobileAppLayout />;
  }
  return <MainLayout />;
}

export default AdaptiveMainLayout;
