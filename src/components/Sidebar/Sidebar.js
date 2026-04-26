import React, { useState } from 'react';
import { matchPath, useLocation } from 'react-router-dom';
import { SidebarContainer, Section, SectionTitle, ToggleButton } from './Sidebar.styles';
import { SidebarNavLink } from './SidebarNavLink';
import { MdDashboard, MdEventNote, MdGridView, MdNotifications, MdOutlineShowChart, MdPerson, MdTrendingUp, MdMenu, MdClose, MdSpeed, MdAutoGraph, MdBarChart, MdDiamond, MdCurrencyExchange, MdVerifiedUser, MdAccountBalanceWallet, MdLock, MdViewModule, MdAttachMoney } from 'react-icons/md';
import { useAuth } from '../../auth/AuthContext';

function normalizePath(pathname) {
  if (!pathname) return '/';
  const trimmed = pathname.replace(/\/+$/, '') || '/';
  return trimmed;
}

/**
 * Whether this sidebar target is the current page. Uses React Router’s matchPath so
 * “/” never matches “/advisor” (programmatic navigate from Dashboard → Advisor updates correctly).
 */
function routeActive(pathname, to) {
  const p = normalizePath(pathname);
  const pattern = normalizePath(to);
  return matchPath({ path: pattern, end: true, caseSensitive: false }, p) != null;
}

function SidebarItem({ to, collapsed, title, pathname, locked, children, active: activeOverride }) {
  const on = activeOverride !== undefined ? activeOverride : routeActive(pathname, to);
  return (
    <SidebarNavLink to={to} collapsed={collapsed} active={on} title={title} locked={locked}>
      {children}
      {locked && !collapsed ? (
        <MdLock size={15} style={{ marginLeft: 'auto', flexShrink: 0, opacity: 0.9 }} aria-hidden />
      ) : null}
    </SidebarNavLink>
  );
}

function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { isSuperAdmin, outlookPremium } = useAuth();
  const moduleLocked = !outlookPremium;
  const { pathname, search } = useLocation();
  const profileTab = new URLSearchParams(search || '').get('tab');
  const onProfile = normalizePath(pathname) === '/profile';
  const profileSidebarActive = onProfile && profileTab !== 'pricing';
  const pricingSidebarActive = onProfile && profileTab === 'pricing';
  const onboardingSidebarActive = routeActive(pathname, '/onboarding');

  return (
    <SidebarContainer collapsed={collapsed}>
      {/* Toggle at top */}
      <ToggleButton onClick={() => setCollapsed((c) => !c)} collapsed={collapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
        {collapsed ? <MdMenu size={22} /> : <MdClose size={18} />}
      </ToggleButton>

      <div className="brand-wrap">
        {!collapsed ? (
          <img src="/ayc-logo.png" alt="AYC Industries" className="brand-logo" />
        ) : (
          <div className="brand-mini">AYC</div>
        )}
      </div>

      <nav aria-label="Main navigation">
        <SidebarItem to="/" collapsed={collapsed} pathname={pathname} title={collapsed ? 'Dashboard' : undefined}>
          <MdDashboard />
          <span className="label">Dashboard</span>
        </SidebarItem>

        <Section collapsed={collapsed}>
          <SectionTitle collapsed={collapsed}>Stocks</SectionTitle>

          <SidebarItem to="/outlook" collapsed={collapsed} pathname={pathname} title={collapsed ? 'Overview' : undefined}>
            <MdOutlineShowChart />
            <span className="label">Overview</span>
          </SidebarItem>

          <SidebarItem
            to="/long-term"
            collapsed={collapsed}
            pathname={pathname}
            locked={moduleLocked}
            title={collapsed ? 'Long Term' : undefined}
          >
            <MdTrendingUp />
            <span className="label">Long Term</span>
          </SidebarItem>

          <SidebarItem
            to="/short-term"
            collapsed={collapsed}
            pathname={pathname}
            locked={moduleLocked}
            title={collapsed ? 'Short Term' : undefined}
          >
            <MdSpeed />
            <span className="label">Short Term</span>
          </SidebarItem>

          <SidebarItem to="/screens" collapsed={collapsed} pathname={pathname} locked={moduleLocked} title={collapsed ? 'Screens' : undefined}>
            <MdGridView />
            <span className="label">Screens</span>
          </SidebarItem>

          <SidebarItem to="/advisor" collapsed={collapsed} pathname={pathname} locked={moduleLocked} title={collapsed ? 'Advisor' : undefined}>
            <MdAutoGraph />
            <span className="label">Advisor</span>
          </SidebarItem>

          <SidebarItem to="/portfolio-manager" collapsed={collapsed} pathname={pathname} locked={moduleLocked} title={collapsed ? 'Portfolio Manager' : undefined}>
            <MdAccountBalanceWallet />
            <span className="label">Portfolio Manager</span>
          </SidebarItem>

          <SidebarItem to="/alerts" collapsed={collapsed} pathname={pathname} locked={moduleLocked} title={collapsed ? 'Alerts' : undefined}>
            <MdNotifications />
            <span className="label">Alerts</span>
          </SidebarItem>
        </Section>

        <Section collapsed={collapsed}>
          <SectionTitle collapsed={collapsed}>Derivatives</SectionTitle>

          <SidebarItem to="/fno" collapsed={collapsed} pathname={pathname} locked={moduleLocked} title={collapsed ? 'F&O' : undefined}>
            <MdBarChart />
            <span className="label">F&O</span>
          </SidebarItem>

          <SidebarItem to="/commodities" collapsed={collapsed} pathname={pathname} locked={moduleLocked} title={collapsed ? 'Commodities' : undefined}>
            <MdDiamond />
            <span className="label">Commodities</span>
          </SidebarItem>

          <SidebarItem to="/forex" collapsed={collapsed} pathname={pathname} locked={moduleLocked} title={collapsed ? 'Forex' : undefined}>
            <MdCurrencyExchange />
            <span className="label">Forex</span>
          </SidebarItem>
        </Section>

        <Section collapsed={collapsed}>
          <SectionTitle collapsed={collapsed}>Resources</SectionTitle>

          <SidebarItem
            to="/profile"
            collapsed={collapsed}
            pathname={pathname}
            title={collapsed ? 'Profile' : undefined}
            active={profileSidebarActive}
          >
            <MdPerson />
            <span className="label">Profile</span>
          </SidebarItem>

          <SidebarItem to="/events" collapsed={collapsed} pathname={pathname} title={collapsed ? 'Events' : undefined}>
            <MdEventNote />
            <span className="label">Events</span>
          </SidebarItem>

          <SidebarItem
            to="/onboarding"
            collapsed={collapsed}
            pathname={pathname}
            title={collapsed ? 'Onboarding' : undefined}
            active={onboardingSidebarActive}
          >
            <MdViewModule />
            <span className="label">Onboarding</span>
          </SidebarItem>

          <SidebarItem
            to="/profile?tab=pricing"
            collapsed={collapsed}
            pathname={pathname}
            title={collapsed ? 'Pricing' : undefined}
            active={pricingSidebarActive}
          >
            <MdAttachMoney />
            <span className="label">Pricing</span>
          </SidebarItem>

          {isSuperAdmin ? (
            <SidebarItem to="/admin-users" collapsed={collapsed} pathname={pathname} title={collapsed ? 'Admin Users' : undefined}>
              <MdVerifiedUser />
              <span className="label">Admin Users</span>
            </SidebarItem>
          ) : null}

          {isSuperAdmin ? (
            <SidebarItem to="/telegram-admin" collapsed={collapsed} pathname={pathname} title={collapsed ? 'Telegram Admin' : undefined}>
              <MdVerifiedUser />
              <span className="label">Telegram Admin</span>
            </SidebarItem>
          ) : null}
        </Section>
      </nav>
    </SidebarContainer>
  );
}

export default Sidebar;