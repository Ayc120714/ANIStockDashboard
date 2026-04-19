import React from 'react';
import { Box, Button, Link, Paper, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const SUPPORT_EMAIL = 'support@aycindustries.com';

/**
 * In-app instructions for moving from Basic to Premium. Payment happens outside this app;
 * your organisation’s admin shares the link or steps; access updates after they confirm payment.
 */
function UpgradePremiumPage() {
  const { outlookPremium } = useAuth();

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', py: 3, px: 2 }}>
      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>
          Upgrade to Premium
        </Typography>
        {outlookPremium ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Your account already has premium access. Use Overview and the rest of the app as usual.
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, color: 'text.primary' }}>
            <Typography variant="body1" sx={{ lineHeight: 1.65 }}>
              When your admin shares the payment link or instructions, complete the <strong>yearly</strong> Premium
              payment outside this app (this site does not take cards).
            </Typography>
            <Typography variant="body1" sx={{ lineHeight: 1.65 }}>
              After they confirm payment, your access usually updates within about <strong>24 hours</strong>. Refresh or
              sign in again — your header badge should show <strong>Premium</strong> and locked areas will open.
            </Typography>
            <Typography variant="body1" sx={{ lineHeight: 1.65 }}>
              Questions? Use <strong>Profile</strong> or email{' '}
              <Link href={`mailto:${SUPPORT_EMAIL}`} underline="hover">
                {SUPPORT_EMAIL}
              </Link>
              .
            </Typography>
          </Box>
        )}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 3 }}>
          <Button component={RouterLink} to="/outlook" variant="contained" size="small" sx={{ textTransform: 'none' }}>
            Back to Overview
          </Button>
          <Button component={RouterLink} to="/profile?tab=pricing" variant="outlined" size="small" sx={{ textTransform: 'none' }}>
            Compare plans
          </Button>
          <Button component={RouterLink} to="/profile" variant="outlined" size="small" sx={{ textTransform: 'none' }}>
            Open Profile
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}

export default UpgradePremiumPage;
