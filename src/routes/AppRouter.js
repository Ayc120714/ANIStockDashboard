import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import DashboardPage from '../pages/DashboardPage';
import LongTermPage from '../pages/LongTermPage';
import ShortTermPage from '../pages/ShortTermPage';
import OutlookPage from '../pages/OutlookPage';
import ScreensPage from '../pages/ScreensPage';
import StockAlertsPage from '../pages/StockAlertsPage';
import FinancialAdvisorPage from '../pages/FinancialAdvisorPage';
import ProfilePage from '../pages/ProfilePage';
import EventsPage from '../pages/EventsPage';
import FnOPage from '../pages/FnOPage';
import CommoditiesPage from '../pages/CommoditiesPage';
import ForexPage from '../pages/ForexPage';

function AppRouter() {
  return (
    <Router>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/long-term" element={<LongTermPage />} />
          <Route path="/short-term" element={<ShortTermPage />} />
          <Route path="/outlook" element={<OutlookPage />} />
          <Route path="/screens" element={<ScreensPage />} />
          <Route path="/advisor" element={<FinancialAdvisorPage />} />
          <Route path="/alerts" element={<StockAlertsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/fno" element={<FnOPage />} />
          <Route path="/commodities" element={<CommoditiesPage />} />
          <Route path="/forex" element={<ForexPage />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default AppRouter;