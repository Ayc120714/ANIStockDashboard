import React from 'react';
import { Box, Button, Link, Paper, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const SUPPORT_EMAIL = 'support@aycindustries.com';

/**
 * In-app instructions for moving from Basic to Premium. Payment is handled outside the app;
 * a super-admin records the annual term under Admin Users → Record payment after funds are confirmed.
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
              Complete the yearly payment using the channel your organisation uses (bank transfer, UPI, invoice,
              etc.). This site does not collect card payments directly.
            </Typography>
            <Typography variant="body1" sx={{ lineHeight: 1.65 }}>
              After payment is received and verified, a super-admin opens <strong>Admin Users</strong>, finds your
              login email, and uses <strong>Record payment</strong> to activate one calendar year of premium (IST), or
              grants access via complimentary / lifetime / allowlist if that is what you purchased.
            </Typography>
            <Typography variant="body1" sx={{ lineHeight: 1.65 }}>
              Refresh the app or log in again; your plan badge in the header should show <strong>Premium</strong> and
              locked areas will open.
            </Typography>
            <Typography variant="body1" sx={{ lineHeight: 1.65 }}>
              If you are unsure who to pay or how to send proof, use <strong>Profile</strong> or contact support through
              the same channel you used to register.
            </Typography>
            <Typography variant="body1" sx={{ lineHeight: 1.65 }}>
              Once payment is done, admin will share the grants with the end user for access. It takes{' '}
              <strong>24 hours</strong> for access to reflect in the app. If you have any issue, please reach{' '}
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
          <Button component={RouterLink} to="/pricing" variant="outlined" size="small" sx={{ textTransform: 'none' }}>
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
