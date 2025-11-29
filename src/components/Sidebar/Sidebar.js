// ...existing code...
import React, { useState } from 'react';
import { SidebarContainer, NavLink, Section, SectionTitle, ToggleButton } from './Sidebar.styles';
import { MdDashboard, MdEventNote, MdGridView, MdNotifications, MdOutlineShowChart, MdPerson, MdTrendingUp, MdMenu, MdClose } from 'react-icons/md';

function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <SidebarContainer collapsed={collapsed}>
      {/* Toggle at top */}
      <ToggleButton onClick={() => setCollapsed((c) => !c)} collapsed={collapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
        {collapsed ? <MdMenu size={22} /> : <MdClose size={18} />}
      </ToggleButton>

      <h2>Stock Dashboard</h2>

      <nav>
        <NavLink to="/" collapsed={collapsed} title={collapsed ? 'Dashboard' : undefined}>
          <MdDashboard />
          <span className="label">Dashboard</span>
        </NavLink>

        <Section collapsed={collapsed}>
          <SectionTitle collapsed={collapsed}>Stocks</SectionTitle>

          <NavLink to="/outlook" collapsed={collapsed} title={collapsed ? 'Outlook' : undefined}>
            <MdOutlineShowChart />
            <span className="label">Outlook</span>
          </NavLink>

          <NavLink to="/long-term" collapsed={collapsed} title={collapsed ? 'Long Term' : undefined}>
            <MdTrendingUp />
            <span className="label">Long Term</span>
          </NavLink>

          <NavLink to="/screens" collapsed={collapsed} title={collapsed ? 'Screens' : undefined}>
            <MdGridView />
            <span className="label">Screens</span>
          </NavLink>

          <NavLink to="/alerts" collapsed={collapsed} title={collapsed ? 'Alerts' : undefined}>
            <MdNotifications />
            <span className="label">Alerts</span>
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
        </Section>
      </nav>
    </SidebarContainer>
  );
}

export default Sidebar;
// ...existing code...