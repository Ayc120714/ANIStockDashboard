import React, { useState } from 'react';
import { matchPath, useLocation } from 'react-router-dom';
import { SidebarContainer, Section, SectionTitle, ToggleButton } from './Sidebar.styles';
import { SidebarNavLink } from './SidebarNavLink';
import { MdDashboard, MdEventNote, MdGridView, MdNotifications, MdOutlineShowChart, MdPerson, MdTrendingUp, MdMenu, MdClose, MdSpeed, MdAutoGraph, MdBarChart, MdDiamond, MdCurrencyExchange, MdVerifiedUser, MdAccountBalanceWallet, MdLock, MdViewModule, MdAttachMoney, MdAssessment } from 'react-icons/md';
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

function SidebarItem({ to, collapsed, title, pathname, locked, inDrawer, children, active: activeOverride }) {
  const on = activeOverride !== undefined ? activeOverride : routeActive(pathname, to);
  return (
    <SidebarNavLink to={to} collapsed={collapsed} active={on} title={title} locked={locked} inDrawer={inDrawer}>
      {children}
      {locked && !collapsed ? (
        <MdLock size={15} style={{ marginLeft: 'auto', flexShrink: 0, opacity: 0.9 }} aria-hidden />
      ) : null}
    </SidebarNavLink>
  );
}

function Sidebar({ variant = 'rail' }) {
  const inDrawer = variant === 'drawer';
  const [collapsed, setCollapsed] = useState(false);
  const navCollapsed = inDrawer ? false : collapsed;
  const { isSuperAdmin, isAdmin, outlookPremium } = useAuth();
  const moduleLocked = !outlookPremium;
  const { pathname, search } = useLocation();
  const profileTab = new URLSearchParams(search || '').get('tab');
  const onProfile = normalizePath(pathname) === '/profile';
  const profileSidebarActive = onProfile && profileTab !== 'pricing';
  const pricingSidebarActive = onProfile && profileTab === 'pricing';
  const onboardingSidebarActive = routeActive(pathname, '/onboarding');

  return (
    <SidebarContainer collapsed={navCollapsed} $inDrawer={inDrawer}>
      {!inDrawer ? (
        <ToggleButton onClick={() => setCollapsed((c) => !c)} collapsed={collapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {collapsed ? <MdMenu size={22} /> : <MdClose size={18} />}
        </ToggleButton>
      ) : null}

      <div className="brand-wrap">
        {!navCollapsed ? (
          <img src="/ayc-logo.png" alt="AYC Industries" className="brand-logo" />
        ) : (
          <div className="brand-mini">AYC</div>
        )}
      </div>

      <nav aria-label="Main navigation">
        <SidebarItem to="/" collapsed={navCollapsed} inDrawer={inDrawer} pathname={pathname} title={navCollapsed ? 'Dashboard' : undefined}>
          <MdDashboard />
          <span className="label">Dashboard</span>
        </SidebarItem>

        <Section collapsed={navCollapsed}>
          <SectionTitle collapsed={navCollapsed} $inDrawer={inDrawer}>
            Stocks
          </SectionTitle>

          <SidebarItem to="/outlook" collapsed={navCollapsed} inDrawer={inDrawer} pathname={pathname} title={navCollapsed ? 'Overview' : undefined}>
            <MdOutlineShowChart />
            <span className="label">Overview</span>
          </SidebarItem>

          <SidebarItem
            to="/long-term"
            collapsed={navCollapsed}
            inDrawer={inDrawer}
            pathname={pathname}
            locked={moduleLocked}
            title={navCollapsed ? 'Long Term' : undefined}
          >
            <MdTrendingUp />
            <span className="label">Long Term</span>
          </SidebarItem>

          <SidebarItem
            to="/short-term"
            collapsed={navCollapsed}
            inDrawer={inDrawer}
            pathname={pathname}
            locked={moduleLocked}
            title={navCollapsed ? 'Short Term' : undefined}
          >
            <MdSpeed />
            <span className="label">Short Term</span>
          </SidebarItem>

          <SidebarItem to="/screens" collapsed={navCollapsed} inDrawer={inDrawer} pathname={pathname} locked={moduleLocked} title={navCollapsed ? 'Screens' : undefined}>
            <MdGridView />
            <span className="label">Screens</span>
          </SidebarItem>

          <SidebarItem to="/advisor" collapsed={navCollapsed} inDrawer={inDrawer} pathname={pathname} locked={moduleLocked} title={navCollapsed ? 'Advisor' : undefined}>
            <MdAutoGraph />
            <span className="label">Advisor</span>
          </SidebarItem>

          {isSuperAdmin ? (
            <SidebarItem to="/next-week-setup" collapsed={navCollapsed} inDrawer={inDrawer} pathname={pathname} title={navCollapsed ? 'Next Week Setup' : undefined}>
              <MdTrendingUp />
              <span className="label">Next Week Setup</span>
            </SidebarItem>
          ) : null}

          <SidebarItem to="/portfolio-manager" collapsed={navCollapsed} inDrawer={inDrawer} pathname={pathname} locked={moduleLocked} title={navCollapsed ? 'Portfolio Manager' : undefined}>
            <MdAccountBalanceWallet />
            <span className="label">Portfolio Manager</span>
          </SidebarItem>

          <SidebarItem to="/alerts" collapsed={navCollapsed} inDrawer={inDrawer} pathname={pathname} locked={moduleLocked} title={navCollapsed ? 'Entry Ready Alerts' : undefined}>
            <MdNotifications />
            <span className="label">Entry Ready Alerts</span>
          </SidebarItem>

          {isAdmin ? (
            <SidebarItem to="/algo-performance" collapsed={navCollapsed} inDrawer={inDrawer} pathname={pathname} title={navCollapsed ? 'Algo performance' : undefined}>
              <MdAssessment />
              <span className="label">Algo performance</span>
            </SidebarItem>
          ) : null}
        </Section>

        <Section collapsed={navCollapsed}>
          <SectionTitle collapsed={navCollapsed} $inDrawer={inDrawer}>
            Derivatives
          </SectionTitle>

          <SidebarItem to="/fno" collapsed={navCollapsed} inDrawer={inDrawer} pathname={pathname} locked={moduleLocked} title={navCollapsed ? 'F&O' : undefined}>
            <MdBarChart />
            <span className="label">F&O</span>
          </SidebarItem>

          <SidebarItem to="/commodities" collapsed={navCollapsed} inDrawer={inDrawer} pathname={pathname} locked={moduleLocked} title={navCollapsed ? 'Commodities' : undefined}>
            <MdDiamond />
            <span className="label">Commodities</span>
          </SidebarItem>

          <SidebarItem to="/forex" collapsed={navCollapsed} inDrawer={inDrawer} pathname={pathname} locked={moduleLocked} title={navCollapsed ? 'Forex' : undefined}>
            <MdCurrencyExchange />
            <span className="label">Forex</span>
          </SidebarItem>

          <SidebarItem to="/mutual-funds" collapsed={collapsed} pathname={pathname} locked={moduleLocked} title={collapsed ? 'Mutual Funds' : undefined}>
            <MdAttachMoney />
            <span className="label">Mutual Funds</span>
          </SidebarItem>
        </Section>

        <Section collapsed={navCollapsed}>
          <SectionTitle collapsed={navCollapsed} $inDrawer={inDrawer}>
            Resources
          </SectionTitle>

          <SidebarItem
            to="/profile"
            collapsed={navCollapsed}
            inDrawer={inDrawer}
            pathname={pathname}
            title={navCollapsed ? 'Profile' : undefined}
            active={profileSidebarActive}
          >
            <MdPerson />
            <span className="label">Profile</span>
          </SidebarItem>

          <SidebarItem to="/events" collapsed={navCollapsed} inDrawer={inDrawer} pathname={pathname} title={navCollapsed ? 'Events' : undefined}>
            <MdEventNote />
            <span className="label">Events</span>
          </SidebarItem>

          <SidebarItem
            to="/onboarding"
            collapsed={navCollapsed}
            inDrawer={inDrawer}
            pathname={pathname}
            title={navCollapsed ? 'Onboarding' : undefined}
            active={onboardingSidebarActive}
          >
            <MdViewModule />
            <span className="label">Onboarding</span>
          </SidebarItem>

          <SidebarItem
            to="/profile?tab=pricing"
            collapsed={navCollapsed}
            inDrawer={inDrawer}
            pathname={pathname}
            title={navCollapsed ? 'Pricing' : undefined}
            active={pricingSidebarActive}
          >
            <MdAttachMoney />
            <span className="label">Pricing</span>
          </SidebarItem>

          {isSuperAdmin ? (
            <SidebarItem to="/admin-users" collapsed={navCollapsed} inDrawer={inDrawer} pathname={pathname} title={navCollapsed ? 'Admin Users' : undefined}>
              <MdVerifiedUser />
              <span className="label">Admin Users</span>
            </SidebarItem>
          ) : null}

          {isSuperAdmin ? (
            <SidebarItem to="/telegram-admin" collapsed={navCollapsed} inDrawer={inDrawer} pathname={pathname} title={navCollapsed ? 'Telegram Admin' : undefined}>
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