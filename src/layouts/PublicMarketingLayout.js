import React from 'react';
import { Outlet, Link as RouterLink } from 'react-router-dom';
import { Box, Button, Card, Typography } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { useAuth } from '../auth/AuthContext';
import MarketDisclaimer from '../components/MarketDisclaimer';
import { marketingPublicTheme } from '../theme/marketingPublicTheme';

const AYC_LOGO_PATH = '/ayc-logo.png';

const PAGE_BG =
  'radial-gradient(circle at 15% 20%, #1d4ed8 0%, #0b1630 45%, #060b19 100%)';

/**
 * Public marketing shell styled like the AYC login page (dark gradient, glass cards, blue CTAs).
 */
function PublicMarketingLayout() {
  const { isAuthenticated, bootstrapping } = useAuth();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        p: { xs: 1, md: 1.6 },
        background: PAGE_BG,
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <ThemeProvider theme={marketingPublicTheme}>
        <Box
          sx={{
            width: '100%',
            maxWidth: 1180,
            display: 'flex',
            flexDirection: 'column',
            gap: { xs: 1.2, md: 1.6 },
          }}
        >
          <Box
            sx={{
              px: { xs: 1.5, md: 2.4 },
              py: { xs: 1.2, md: 1.4 },
              borderRadius: 2.5,
              border: '1px solid rgba(96,165,250,0.28)',
              background: 'linear-gradient(120deg, rgba(10,22,52,0.94), rgba(20,52,128,0.52))',
              boxShadow: '0 12px 30px rgba(0,0,0,0.28)',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1.2,
            }}
          >
            <Box
              component={RouterLink}
              to="/login"
              sx={{ display: 'flex', alignItems: 'center', gap: 1.5, textDecoration: 'none', minWidth: 0 }}
            >
              <Box
                component="img"
                src={AYC_LOGO_PATH}
                alt="AYC Industries"
                sx={{ height: { xs: 44, md: 56 }, width: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 6px 14px rgba(37,99,235,0.22))' }}
              />
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ color: '#f8fafc', fontWeight: 900, fontSize: { xs: '1rem', sm: '1.1rem' }, lineHeight: 1.25 }}>
                  AYC Stock Dashboard
                </Typography>
                <Typography sx={{ color: '#93c5fd', fontSize: '0.78rem', fontWeight: 600, display: { xs: 'none', sm: 'block' } }}>
                  {'Product & access overview'}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'flex-end' }}>
              {!bootstrapping && isAuthenticated ? (
                <Button component={RouterLink} to="/" variant="contained" size="small" sx={{ textTransform: 'none', fontWeight: 800 }}>
                  Open dashboard
                </Button>
              ) : (
                <>
                  <Button component={RouterLink} to="/login" variant="outlined" size="small" sx={{ textTransform: 'none', fontWeight: 700 }}>
                    Sign in
                  </Button>
                  <Button component={RouterLink} to="/signup" variant="contained" size="small" sx={{ textTransform: 'none', fontWeight: 800 }}>
                    Sign up
                  </Button>
                </>
              )}
            </Box>
          </Box>

          <Card
            sx={{
              p: { xs: 1.8, md: 2.4 },
              borderRadius: 2.7,
              color: '#e8efff',
              background: 'linear-gradient(135deg, rgba(10,24,58,0.96), rgba(6,15,38,0.92))',
              boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
              border: '1px solid rgba(148,163,184,0.2)',
              flex: 1,
            }}
          >
            <Box
              sx={{
                mb: 1.25,
                px: 1.2,
                py: 0.8,
                borderRadius: 1.6,
                border: '1px solid rgba(96,165,250,0.35)',
                background: 'linear-gradient(120deg, rgba(30,64,175,0.24), rgba(14,165,233,0.2))',
                color: '#dbeafe',
                fontSize: 12.5,
                fontWeight: 600,
              }}
            >
              Note: This application is best viewed on a laptop or monitor; mobile view may feel condensed.
            </Box>
            <Outlet />
          </Card>

          <Box sx={{ px: { xs: 0.5, sm: 0 } }}>
            <MarketDisclaimer variant="login" />
          </Box>
        </Box>
      </ThemeProvider>
    </Box>
  );
}

export default PublicMarketingLayout;
