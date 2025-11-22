import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import DashboardPage from '../pages/DashboardPage';
import LongTermPage from '../pages/LongTermPage';
import OutlookPage from '../pages/OutlookPage';
import ScreensPage from '../pages/ScreensPage';
import StockAlertsPage from '../pages/StockAlertsPage';
import ProfilePage from '../pages/ProfilePage';
import EventsPage from '../pages/EventsPage';

function AppRouter() {
  return (
    <Router>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/long-term" element={<LongTermPage />} />
          <Route path="/outlook" element={<OutlookPage />} />
          <Route path="/screens" element={<ScreensPage />} />
          <Route path="/alerts" element={<StockAlertsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/events" element={<EventsPage />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default AppRouter;