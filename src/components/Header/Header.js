import React from 'react';
import { HeaderContainer } from './Header.styles';
import { Box, Button } from '@mui/material';
import { useAuth } from '../../auth/AuthContext';

function Header() {
  const { user, logout } = useAuth();

  return (
    <HeaderContainer>
      <h1>Welcome to Stock Dashboard</h1>
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