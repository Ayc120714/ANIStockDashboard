import React from 'react';
import useDeviceViewMode from '../hooks/useDeviceViewMode';
import MainLayout from './MainLayout';
import MobileAppLayout from './MobileAppLayout';

/** Phone browsers → app shell; laptop & tablet → web layout with sidebar. */
function AdaptiveMainLayout() {
  const viewMode = useDeviceViewMode();
  if (viewMode === 'app') {
    return <MobileAppLayout />;
  }
  return <MainLayout />;
}

export default AdaptiveMainLayout;
