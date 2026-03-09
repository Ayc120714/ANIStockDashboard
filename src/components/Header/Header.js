import React from 'react';
import { HeaderContainer } from './Header.styles';
import { Box, Button } from '@mui/material';
import { useAuth } from '../../auth/AuthContext';

function Header() {
  const { user, logout } = useAuth();

  return (
    <HeaderContainer>
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
            maxWidth: { xs: 260, md: 520, lg: 640 },
            height: { xs: 32, md: 42, lg: 48 },
            objectFit: 'contain',
            objectPosition: 'center center',
          }}
        />
      </Box>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <span style={{ color: '#555', fontSize: 13 }}>
          {user?.full_name || user?.email || ''}
        </span>
        <Button size="small" variant="outlined" onClick={logout}>
          Logout
        </Button>
      </Box>
    </HeaderContainer>
  );
}

export default Header;