import React, { useMemo } from 'react';
import { HeaderContainer } from './Header.styles';
import { Box, Button, IconButton } from '@mui/material';
import { MdMenu } from 'react-icons/md';
import { useAuth } from '../../auth/AuthContext';
import UserNotificationBell from './UserNotificationBell';

function Header({ showMenuButton, onMenuOpen }) {
  const { user, logout, outlookPremium } = useAuth();

  const planLabel = useMemo(() => {
    if (user?.premium_lifetime === true) return 'Lifetime';
    if (outlookPremium) return 'Premium';
    return 'Basic';
  }, [user?.premium_lifetime, outlookPremium]);

  return (
    <HeaderContainer>
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
        }}
      >
        {showMenuButton ? (
          <IconButton
            color="primary"
            aria-label="Open navigation menu"
            onClick={onMenuOpen}
            edge="start"
            size="medium"
            sx={{
              flexShrink: 0,
              border: '1px solid rgba(37, 99, 235, 0.28)',
              bgcolor: 'rgba(255,255,255,0.9)',
            }}
          >
            <MdMenu size={24} />
          </IconButton>
        ) : null}
        <Box
          aria-label="AYC Industries logo"
          sx={{
            flex: 1,
            minWidth: 0,
            height: { xs: 48, md: 62 },
            borderRadius: 1.2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            px: { xs: 0.8, md: 1.4 },
            border: '1px solid rgba(249, 115, 22, 0.2)',
            background: 'linear-gradient(100deg, rgba(255,255,255,0.75), rgba(255,247,237,0.78))',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.5)',
            opacity: 0.98,
          }}
        >
          <Box
            component="img"
            src="/ayc-logo.png"
            alt="AYC Industries"
            sx={{
              width: '100%',
              maxWidth: { xs: 220, sm: 260, md: 520, lg: 640 },
              height: { xs: 30, md: 42, lg: 48 },
              objectFit: 'contain',
              objectPosition: 'center center',
            }}
          />
        </Box>
      </Box>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <span style={{ color: '#555', fontSize: 13 }}>
            {user?.full_name || user?.email || ''}
          </span>
          <Box
            component="span"
            sx={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: 0.06,
              textTransform: 'uppercase',
              px: 1,
              py: 0.35,
              borderRadius: 1,
              border: '1px solid',
              ...(planLabel === 'Lifetime'
                ? { color: '#1565c0', borderColor: 'rgba(21, 101, 192, 0.45)', bgcolor: 'rgba(21, 101, 192, 0.08)' }
                : planLabel === 'Premium'
                  ? { color: '#2e7d32', borderColor: 'rgba(46, 125, 50, 0.45)', bgcolor: 'rgba(46, 125, 50, 0.08)' }
                  : { color: '#616161', borderColor: 'rgba(97, 97, 97, 0.4)', bgcolor: 'rgba(0,0,0,0.04)' }),
            }}
          >
            {planLabel}
          </Box>
        </Box>
        <UserNotificationBell />
        <Button size="small" variant="outlined" onClick={logout}>
          Logout
        </Button>
      </Box>
    </HeaderContainer>
  );
}

export default Header;