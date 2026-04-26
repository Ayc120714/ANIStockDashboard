import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import DashboardPage from '../pages/DashboardPage';
import LongTermPage from '../pages/LongTermPage';
import ShortTermPage from '../pages/ShortTermPage';
import OutlookPage from '../pages/OutlookPage';
import ScreensPage from '../pages/ScreensPage';
import StockAlertsPage from '../pages/StockAlertsPage';
import FinancialAdvisorPage from '../pages/FinancialAdvisorPage';
import PortfolioManagerPage from '../pages/PortfolioManagerPage';
import ProfilePage from '../pages/ProfilePage';
import EventsPage from '../pages/EventsPage';
import FeaturesPage from '../pages/FeaturesPage';
import PricingPage from '../pages/PricingPage';
import PrivacyPolicyPage from '../pages/PrivacyPolicyPage';
import TermsOfUsePage from '../pages/TermsOfUsePage';
import CancellationPolicyPage from '../pages/CancellationPolicyPage';
import PublicMarketingLayout from '../layouts/PublicMarketingLayout';
import FnOPage from '../pages/FnOPage';
import CommoditiesPage from '../pages/CommoditiesPage';
import ForexPage from '../pages/ForexPage';
import TelegramAdminPage from '../pages/TelegramAdminPage';
import AdminUsersPage from '../pages/AdminUsersPage';
import LoginPage from '../pages/LoginPage';
import SignupPage from '../pages/SignupPage';
import OtpVerifyPage from '../pages/OtpVerifyPage';
import ForgotUserIdPage from '../pages/ForgotUserIdPage';
import ForgotPasswordPage from '../pages/ForgotPasswordPage';
import DhanCallbackPage from '../pages/DhanCallbackPage';
import AccessLinkSetupPage from '../pages/AccessLinkSetupPage';
import UpgradePremiumPage from '../pages/UpgradePremiumPage';
import ProtectedRoute from './ProtectedRoute';
import AdminRoute from './AdminRoute';
import PremiumModuleRoute from './PremiumModuleRoute';

function AppRouter() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/verify-otp" element={<OtpVerifyPage />} />
        <Route path="/forgot-user-id" element={<ForgotUserIdPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/access-link-setup" element={<AccessLinkSetupPage />} />

        <Route element={<PublicMarketingLayout />}>
          <Route path="/features" element={<Navigate to="/onboarding" replace />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="/terms-of-use" element={<TermsOfUsePage />} />
          <Route path="/cancellation-policy" element={<CancellationPolicyPage />} />
        </Route>

        <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/long-term" element={<PremiumModuleRoute><LongTermPage /></PremiumModuleRoute>} />
          <Route path="/short-term" element={<PremiumModuleRoute><ShortTermPage /></PremiumModuleRoute>} />
          <Route path="/outlook" element={<OutlookPage />} />
          <Route path="/screens" element={<PremiumModuleRoute><ScreensPage /></PremiumModuleRoute>} />
          <Route path="/advisor" element={<PremiumModuleRoute><FinancialAdvisorPage /></PremiumModuleRoute>} />
          <Route path="/video-screener" element={<Navigate to="/screens" replace />} />
          <Route path="/portfolio-manager" element={<PremiumModuleRoute><PortfolioManagerPage /></PremiumModuleRoute>} />
          <Route path="/alerts" element={<PremiumModuleRoute><StockAlertsPage /></PremiumModuleRoute>} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/upgrade-premium" element={<UpgradePremiumPage />} />
          <Route path="/callback" element={<DhanCallbackPage />} />
          <Route path="/dhan-callback" element={<DhanCallbackPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/onboarding" element={<FeaturesPage />} />
          <Route path="/fno" element={<PremiumModuleRoute><FnOPage /></PremiumModuleRoute>} />
          <Route path="/commodities" element={<PremiumModuleRoute><CommoditiesPage /></PremiumModuleRoute>} />
          <Route path="/forex" element={<PremiumModuleRoute><ForexPage /></PremiumModuleRoute>} />
          <Route path="/telegram-admin" element={<AdminRoute><TelegramAdminPage /></AdminRoute>} />
          <Route path="/admin-users" element={<AdminRoute><AdminUsersPage /></AdminRoute>} />
        </Route>
      </Routes>
    </Router>
  );
}

export default AppRouter;