import React from 'react';
import { Box, Link as MuiLink } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const bannerSx = {
  mb: 1.5,
  px: 1.5,
  py: 1.25,
  borderRadius: 1,
  border: '1px solid',
  borderColor: 'primary.light',
  bgcolor: 'rgba(25, 118, 210, 0.06)',
  color: 'primary.dark',
  fontSize: 13,
  lineHeight: 1.5,
};

/**
 * Shown on Overview and related views for basic users. Links to /upgrade-premium for payment / access steps.
 */
function UpgradeToPremiumBanner() {
  const { outlookPremium } = useAuth();
  if (outlookPremium) return null;

  return (
    <Box sx={bannerSx}>
      <MuiLink
        component={RouterLink}
        to="/upgrade-premium"
        underline="hover"
        sx={{ fontWeight: 800, color: 'primary.main', mr: 0.5 }}
      >
        Upgrade to Premium
      </MuiLink>
      <Box component="span" sx={{ color: 'text.secondary' }}>
        — Full steps, timing (up to 24 hours), and support contact are on the next page.
      </Box>
    </Box>
  );
}

export default UpgradeToPremiumBanner;
