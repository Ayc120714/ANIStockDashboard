import React, { useState } from 'react';
import { SidebarContainer, NavLink, Section, SectionTitle, ToggleButton } from './Sidebar.styles';
import { MdDashboard, MdEventNote, MdGridView, MdNotifications, MdOutlineShowChart, MdPerson, MdTrendingUp, MdMenu, MdClose, MdSpeed, MdAutoGraph, MdBarChart, MdDiamond, MdCurrencyExchange, MdVerifiedUser, MdAccountBalanceWallet, MdVideoLibrary } from 'react-icons/md';
import { useAuth } from '../../auth/AuthContext';

function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { isAdmin } = useAuth();

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

      <nav>
        <NavLink to="/" collapsed={collapsed} title={collapsed ? 'Dashboard' : undefined}>
          <MdDashboard />
          <span className="label">Dashboard</span>
        </NavLink>

        <Section collapsed={collapsed}>
          <SectionTitle collapsed={collapsed}>Stocks</SectionTitle>

          <NavLink to="/outlook" collapsed={collapsed} title={collapsed ? 'Overview' : undefined}>
            <MdOutlineShowChart />
            <span className="label">Overview</span>
          </NavLink>

          <NavLink to="/long-term" collapsed={collapsed} title={collapsed ? 'Long Term' : undefined}>
            <MdTrendingUp />
            <span className="label">Long Term</span>
          </NavLink>

          <NavLink to="/short-term" collapsed={collapsed} title={collapsed ? 'Short Term' : undefined}>
            <MdSpeed />
            <span className="label">Short Term</span>
          </NavLink>

          <NavLink to="/screens" collapsed={collapsed} title={collapsed ? 'Screens' : undefined}>
            <MdGridView />
            <span className="label">Screens</span>
          </NavLink>

          <NavLink to="/advisor" collapsed={collapsed} title={collapsed ? 'Advisor' : undefined}>
            <MdAutoGraph />
            <span className="label">Advisor</span>
          </NavLink>

          <NavLink to="/video-screener" collapsed={collapsed} title={collapsed ? 'Video Screener' : undefined}>
            <MdVideoLibrary />
            <span className="label">Video Screener</span>
          </NavLink>

          <NavLink to="/portfolio-manager" collapsed={collapsed} title={collapsed ? 'Portfolio Manager' : undefined}>
            <MdAccountBalanceWallet />
            <span className="label">Portfolio Manager</span>
          </NavLink>

          <NavLink to="/alerts" collapsed={collapsed} title={collapsed ? 'Alerts' : undefined}>
            <MdNotifications />
            <span className="label">Alerts</span>
          </NavLink>
        </Section>

        <Section collapsed={collapsed}>
          <SectionTitle collapsed={collapsed}>Derivatives</SectionTitle>

          <NavLink to="/fno" collapsed={collapsed} title={collapsed ? 'F&O' : undefined}>
            <MdBarChart />
            <span className="label">F&O</span>
          </NavLink>

          <NavLink to="/commodities" collapsed={collapsed} title={collapsed ? 'Commodities' : undefined}>
            <MdDiamond />
            <span className="label">Commodities</span>
          </NavLink>

          <NavLink to="/forex" collapsed={collapsed} title={collapsed ? 'Forex' : undefined}>
            <MdCurrencyExchange />
            <span className="label">Forex</span>
          </NavLink>
        </Section>

        <Section collapsed={collapsed}>
          <SectionTitle collapsed={collapsed}>Resources</SectionTitle>

          <NavLink to="/profile" collapsed={collapsed} title={collapsed ? 'Profile' : undefined}>
            <MdPerson />
            <span className="label">Profile</span>
          </NavLink>

          <NavLink to="/events" collapsed={collapsed} title={collapsed ? 'Events' : undefined}>
            <MdEventNote />
            <span className="label">Events</span>
          </NavLink>

          {isAdmin ? (
            <NavLink to="/admin-users" collapsed={collapsed} title={collapsed ? 'Admin Users' : undefined}>
              <MdVerifiedUser />
              <span className="label">Admin Users</span>
            </NavLink>
          ) : null}

          {isAdmin ? (
            <NavLink to="/telegram-admin" collapsed={collapsed} title={collapsed ? 'Telegram Admin' : undefined}>
              <MdVerifiedUser />
              <span className="label">Telegram Admin</span>
            </NavLink>
          ) : null}
        </Section>
      </nav>
    </SidebarContainer>
  );
}

export default Sidebar;