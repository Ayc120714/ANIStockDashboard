import React from 'react';
import useDeviceViewMode from '../hooks/useDeviceViewMode';
import MainLayout from './MainLayout';
import MobileAppLayout from './MobileAppLayout';
import EntryReadyAlertNotifier from '../components/EntryReadyAlertNotifier';

/** Phone browsers → app shell; laptop & tablet → web layout with sidebar. */
function AdaptiveMainLayout() {
  const viewMode = useDeviceViewMode();
  return (
    <>
      <EntryReadyAlertNotifier />
      {viewMode === 'app' ? <MobileAppLayout /> : <MainLayout />}
    </>
  );
}

export default AdaptiveMainLayout;
