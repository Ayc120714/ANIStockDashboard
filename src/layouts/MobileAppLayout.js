import React, {useCallback, useEffect, useState} from 'react';
import {Outlet, useLocation, useNavigate} from 'react-router';
import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import Sidebar from '../components/Sidebar/Sidebar';
import Header from '../components/Header/Header';
import {BootstrapReadyProvider} from '../context/BootstrapReadyContext';
import {MobileNavDrawerProvider} from '../context/MobileNavDrawerContext';
import {MOBILE_APP_TABS, activeMobileAppTab, tabMatchesPath} from '../utils/deviceView';
import {
  AppContent,
  AppRoot,
  BottomNav,
  BottomNavButton,
  BottomNavIcon,
  BottomNavLabel,
  MainColumn,
} from './MobileAppLayout.styles';

function MobileAppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname, location.search]);

  const activeTab = activeMobileAppTab(location.pathname, location.search);

  return (
    <BootstrapReadyProvider pollMs={3000} maxWaitForApiMs={60000}>
      <MobileNavDrawerProvider onRequestClose={closeDrawer}>
        <AppRoot>
          <Drawer
            anchor="left"
            open={drawerOpen}
            onClose={closeDrawer}
            ModalProps={{keepMounted: true}}
            PaperProps={{
              sx: {
                width: 280,
                maxWidth: '88vw',
                boxSizing: 'border-box',
                background: 'transparent',
                overflow: 'hidden',
              },
            }}
          >
            <Box role="presentation" sx={{height: '100%', overflow: 'auto'}}>
              <Sidebar variant="drawer" />
            </Box>
          </Drawer>

          <MainColumn>
            <Header showMenuButton onMenuOpen={() => setDrawerOpen(true)} />
            <AppContent>
              <Outlet />
            </AppContent>
          </MainColumn>

          <BottomNav aria-label="Primary navigation">
            {MOBILE_APP_TABS.map(tab => {
              const active =
                activeTab === tab.id
                || (!activeTab && tabMatchesPath(tab, location.pathname, location.search));
              const targetPath = tab.path.split('?')[0];
              const targetSearch = tab.path.includes('?') ? tab.path.slice(tab.path.indexOf('?')) : '';
              return (
                <BottomNavButton
                  key={tab.id}
                  type="button"
                  $active={active}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => navigate({pathname: targetPath, search: targetSearch || undefined})}
                >
                  <BottomNavIcon $active={active}>{tab.icon || '•'}</BottomNavIcon>
                  <BottomNavLabel $active={active}>{tab.label}</BottomNavLabel>
                </BottomNavButton>
              );
            })}
          </BottomNav>
        </AppRoot>
      </MobileNavDrawerProvider>
    </BootstrapReadyProvider>
  );
}

export default MobileAppLayout;
