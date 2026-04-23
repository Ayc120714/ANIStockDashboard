import React, { useMemo, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, IconButton, InputAdornment, TextField, Typography } from '@mui/material';
import { MdVisibility, MdVisibilityOff } from 'react-icons/md';
import { useLocation, useNavigate } from 'react-router-dom';
import MarketDisclaimer from '../components/MarketDisclaimer';
import { loginStart } from '../api/auth';
import { clearConsentLimitMarkersToday, hasAnyConsentLimitMarkerToday, routeAfterLogin } from '../auth/postLoginRouting';
import { useAuth } from '../auth/AuthContext';

const AYC_LOGO_PATH = '/ayc-logo.png';
const CARD_FONT_FAMILY = '"Inter", "Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif';

const DEFAULT_LOGIN_CONTENT = {
  header: {
    tagline: 'Building the Future of Industry & Growth',
  },
  section1: {
    label: 'Who We Are',
    title: 'Building the Future of Industry & Growth',
    intro: 'At AYC Industries, we combine strategic intelligence, innovation, and operational excellence to deliver powerful solutions for modern markets.',
    philosophy: 'Analyze • Yield • Conquer',
    body: 'Through data-driven strategies and forward-thinking innovation, we help businesses, investors, and partners achieve sustainable growth and long-term success.',
  },
  section2Label: 'Our Core Framework',
  frameworkItems: [
    {
      title: 'Analyze',
      text: 'We evaluate markets, technology, and opportunities using deep research and analytics to uncover hidden potential.',
    },
    {
      title: 'Yield',
      text: 'We convert insight into measurable results through smart execution, operational efficiency, and value creation.',
    },
    {
      title: 'Conquer',
      text: 'We lead markets through innovation, resilience, and bold expansion strategies.',
    },
  ],
  section3Label: 'Our Solutions',
  solutionItems: [
    {
      title: 'Industrial Development',
      text: 'Advanced systems, infrastructure, and manufacturing excellence.',
    },
    {
      title: 'Strategic Market Solutions',
      text: 'Data-driven investment insights and financial intelligence.',
    },
    {
      title: 'Global Partnerships',
      text: 'Collaborating with innovators, enterprises, and emerging markets.',
    },
    {
      title: 'Innovation & Technology',
      text: 'Future-ready systems designed for growth and efficiency.',
    },
  ],
  section4Label: 'Why Choose AYC Industries',
  whyItems: [
    'Strategic intelligence',
    'Data-driven decision making',
    'Global market perspective',
    'Innovation-led development',
    'Sustainable long-term growth',
  ],
  section4Closing: 'AYC Industries is built for the next generation of industrial and financial leadership.',
  section5Label: 'Vision',
  section5Text: 'To become a global leader in innovation, industry, and strategic growth, empowering businesses to transform opportunity into success.',
  section6Label: 'Call to Action',
  section6Title: 'Partner with AYC Industries',
  section6Text: 'Discover how AYC Industries can help you unlock new possibilities and accelerate growth.',
  ctaPrimary: 'Contact Us',
  footer: {
    brand: 'AYC Industries',
    motto: 'Analyze • Yield • Conquer',
    location: 'Global Innovation',
    email: '',
    mobile: '',
    web: '',
    copyright: '© 2026 AYC Industries. All Rights Reserved.',
  },
};

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { persistAuth, hydrateMe } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showConsentInfo, setShowConsentInfo] = useState(() =>
    hasAnyConsentLimitMarkerToday() || Boolean(location.state?.brokerConsentLimited)
  );

  const canSubmitPassword = useMemo(
    () => email.trim().length > 0 && password.length >= 8,
    [email, password]
  );
  const resolveFallbackPath = () => {
    const fromState = location.state?.from;
    if (typeof fromState === 'string' && fromState.trim()) return fromState.trim();
    if (fromState && typeof fromState === 'object') {
      const p = String(fromState.pathname || '').trim();
      const s = String(fromState.search || '').trim();
      const h = String(fromState.hash || '').trim();
      if (p) return `${p}${s}${h}`;
    }
    return '/';
  };

  const onPasswordLogin = async (e) => {
    e.preventDefault();
    if (!canSubmitPassword) return;
    setLoading(true);
    setError('');
    try {
      const res = await loginStart(email.trim(), password);
      const fallbackPath = resolveFallbackPath();
      if (res?.mfa_required === false && res?.access_token && res?.refresh_token) {
        persistAuth(res.access_token, res.refresh_token, res?.user || null);
        await hydrateMe();
        await routeAfterLogin({
          nextUser: res?.user || null,
          fallbackPath,
          navigate,
        });
        return;
      }
      navigate('/verify-otp', {
        state: {
          flowId: res?.flow_id,
          purpose: res?.purpose || 'login',
          requires: res?.requires || ['email'],
          email: email.trim(),
          from: fallbackPath,
        },
      });
    } catch (err) {
      setError(err?.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const authInputSx = {
    '& .MuiInputBase-input': { color: '#0f172a', fontWeight: 500 },
    '& .MuiFormLabel-root': { color: '#334155' },
    '& .MuiFormHelperText-root': { color: '#64748b' },
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        p: { xs: 1, md: 1.6 },
        background: 'radial-gradient(circle at 15% 20%, #1d4ed8 0%, #0b1630 45%, #060b19 100%)',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <Box
        sx={{
          width: '100%',
          maxWidth: '100%',
          minHeight: { xs: 'auto', md: 'calc(100vh - 42px)' },
          display: 'flex',
          flexDirection: 'column',
          gap: { xs: 1.2, md: 1.6 },
        }}
      >
        <Box
          sx={{
            px: { xs: 1.2, md: 2.4, xl: 4 },
            py: { xs: 1.2, md: 1.6 },
            borderRadius: 2.5,
            border: '1px solid rgba(248,113,113,0.35)',
            background: 'linear-gradient(120deg, rgba(10,22,52,0.94), rgba(20,52,128,0.52))',
            boxShadow: '0 12px 30px rgba(0,0,0,0.28)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.8,
          }}
        >
          <Box
            component="img"
            src={AYC_LOGO_PATH}
            alt="AYC Industries"
            sx={{
              width: '100%',
              maxWidth: 1800,
              height: { xs: 68, md: 98, xl: 120 },
              objectFit: 'contain',
              objectPosition: 'center',
              filter: 'drop-shadow(0 6px 14px rgba(37,99,235,0.22))',
            }}
          />
          <Typography
            sx={{
              width: '100%',
              textAlign: 'center',
              color: '#dbeafe',
              fontWeight: 800,
              fontSize: 'clamp(15px, 1.2vw, 26px)',
              letterSpacing: 0.45,
            }}
          >
            {DEFAULT_LOGIN_CONTENT.header.tagline}
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.4fr) minmax(460px, 620px)' },
            gap: { xs: 1.2, md: 1.6 },
            flex: 1,
            minHeight: 0,
          }}
        >
          <Card
            sx={{
              p: { xs: 1.8, md: 2.3 },
              borderRadius: 2.7,
              color: '#e8efff',
              background: 'linear-gradient(135deg, rgba(10,24,58,0.96), rgba(6,15,38,0.92))',
              boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
              border: '1px solid rgba(148,163,184,0.2)',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              fontFamily: CARD_FONT_FAMILY,
              '& .MuiTypography-root': {
                fontFamily: CARD_FONT_FAMILY,
              },
            }}
          >
            <Box
              sx={{
                overflowY: 'auto',
                pr: { xs: 0.1, md: 0.45, xl: 0.7 },
                display: 'grid',
                gap: 1.2,
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', xl: 'repeat(2, minmax(0, 1fr))' },
                '& .MuiTypography-root': {
                  lineHeight: 1.5,
                },
              }}
            >
              <Box
                sx={{
                  p: { xs: 1.25, xl: 1.55 },
                  borderRadius: 1.8,
                  border: '1px solid rgba(96,165,250,0.26)',
                  background: 'linear-gradient(180deg, rgba(30,64,175,0.28), rgba(15,23,42,0.48))',
                  gridColumn: { xs: '1 / -1', md: '1 / -1' },
                }}
              >
                <Typography sx={{ color: '#93c5fd', fontWeight: 800, fontSize: 'clamp(18px, 1vw, 24px)', mb: 0.5 }}>
                  {DEFAULT_LOGIN_CONTENT.section1.label}
                </Typography>
                <Typography sx={{ color: '#f1f5f9', fontWeight: 700, mb: 0.45, fontSize: 'clamp(22px, 1.2vw, 30px)' }}>
                  {DEFAULT_LOGIN_CONTENT.section1.title}
                </Typography>
                <Typography sx={{ color: '#dbeafe', fontSize: 'clamp(15px, 0.9vw, 20px)', lineHeight: 1.55 }}>
                  {DEFAULT_LOGIN_CONTENT.section1.intro}
                </Typography>
                <Typography sx={{ color: '#bfdbfe', fontWeight: 800, mt: 0.85, fontSize: 'clamp(16px, 1vw, 22px)' }}>
                  {DEFAULT_LOGIN_CONTENT.section1.philosophy}
                </Typography>
                <Typography sx={{ color: '#dbeafe', fontSize: 'clamp(15px, 0.9vw, 20px)', lineHeight: 1.55, mt: 0.7 }}>
                  {DEFAULT_LOGIN_CONTENT.section1.body}
                </Typography>
              </Box>

              

              

              
            </Box>
          </Card>

          <Box sx={{ display: 'grid', gap: 1.2, alignSelf: 'start', position: { lg: 'sticky' }, top: { lg: 0 } }}>
            <Card
              sx={{
                width: '100%',
                borderRadius: 2.7,
                background: 'linear-gradient(170deg, rgba(255,255,255,0.97), rgba(240,248,255,0.94))',
                boxShadow: '0 22px 45px rgba(5,10,28,0.35)',
                border: '1px solid rgba(59,130,246,0.22)',
                fontFamily: CARD_FONT_FAMILY,
                '& .MuiTypography-root': {
                  fontFamily: CARD_FONT_FAMILY,
                },
              }}
            >
              <Box
                sx={{
                  px: { xs: 2.2, md: 3 },
                  py: 1.6,
                  color: '#fff',
                  background: 'linear-gradient(110deg, #1d4ed8 0%, #0ea5e9 100%)',
                }}
              >
                <Typography sx={{ fontWeight: 800, fontSize: 'clamp(20px, 1.2vw, 28px)' }}>
                  Welcome Back
                </Typography>
                <Typography sx={{ opacity: 0.92, fontSize: 'clamp(13px, 0.8vw, 16px)' }}>
                  Sign in with password, then verify with email OTP
                </Typography>
              </Box>
              <CardContent sx={{ p: { xs: 2.2, md: 3 } }}>
                <Typography sx={{ mb: 2, color: '#475569', fontSize: 'clamp(14px, 0.85vw, 18px)' }}>
                  Sign in to continue with AYC Industries strategic dashboard.
                </Typography>
                {showConsentInfo ? (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    Broker consent was skipped today due to daily limit. You can continue login to access dashboard normally.
                    <Box sx={{ mt: 1 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          clearConsentLimitMarkersToday();
                          setShowConsentInfo(false);
                        }}
                      >
                        Retry Broker Login Today
                      </Button>
                    </Box>
                  </Alert>
                ) : null}
          {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
                <Box component="form" autoComplete="off" onSubmit={onPasswordLogin} sx={{ display: 'grid', gap: 1.2 }}>
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              size="small"
              name="login_email_no_autofill"
              autoComplete="off"
              inputProps={{ autoComplete: 'off' }}
                    sx={authInputSx}
            />
              <TextField
                label="Password"
                    type={showLoginPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                size="small"
                name="login_password_no_autofill"
                autoComplete="new-password"
                inputProps={{ autoComplete: 'new-password' }}
                    sx={authInputSx}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                            edge="end"
                            size="small"
                            onClick={() => setShowLoginPassword((v) => !v)}
                            onMouseDown={(e) => e.preventDefault()}
                          >
                            {showLoginPassword ? <MdVisibilityOff size={22} /> : <MdVisibility size={22} />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={!canSubmitPassword || loading}
                    sx={{
                      py: 1.1,
                      fontWeight: 700,
                      textTransform: 'none',
                      backgroundColor: '#1d4ed8',
                      '&:hover': { backgroundColor: '#1e40af' },
                      '&.Mui-disabled': { backgroundColor: '#cbd5e1', color: '#64748b' },
                    }}
                  >
                    {loading ? 'Please wait…' : 'Login'}
              </Button>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                    <Button variant="text" onClick={() => navigate('/forgot-user-id')} sx={{ textTransform: 'none', p: 0, color: '#1d4ed8', fontWeight: 700 }}>
                Forgot User ID?
              </Button>
                    <Button variant="text" onClick={() => navigate('/forgot-password')} sx={{ textTransform: 'none', p: 0, color: '#1d4ed8', fontWeight: 700 }}>
                Forgot Password?
              </Button>
            </Box>
                  <Button variant="text" onClick={() => navigate('/signup')} sx={{ textTransform: 'none', color: '#1d4ed8', fontWeight: 700 }}>
              New user? Sign up
            </Button>
          </Box>
        </CardContent>
      </Card>

            <Card
              sx={{
                borderRadius: 2.4,
                background: 'rgba(15,23,42,0.88)',
                border: '1px solid rgba(96,165,250,0.35)',
                fontFamily: CARD_FONT_FAMILY,
                '& .MuiTypography-root': {
                  fontFamily: CARD_FONT_FAMILY,
                },
              }}
            >
              <CardContent sx={{ p: 1.6 }}>
                <Typography sx={{ color: '#93c5fd', fontWeight: 800, fontSize: 'clamp(16px, 0.95vw, 22px)', mb: 0.4 }}>
                  Contact & Support
                </Typography>
                <Typography sx={{ color: '#dbeafe', fontSize: 'clamp(14px, 0.9vw, 18px)', lineHeight: 1.45 }}>
                  Mobile: +919989927143
                </Typography>
                <Typography sx={{ color: '#dbeafe', fontSize: 'clamp(14px, 0.9vw, 18px)', lineHeight: 1.45 }}>
                  Email: support@aycindustries.com
                </Typography>
                <Typography sx={{ color: '#dbeafe', fontSize: 'clamp(14px, 0.9vw, 18px)', lineHeight: 1.45 }}>
                  Website: www.aycindustries.com
                </Typography>
              </CardContent>
            </Card>
          </Box>
        </Box>

        <Box sx={{ px: { xs: 1.2, md: 2.4, xl: 4 }, width: '100%', maxWidth: 1200, mx: 'auto', mt: 1 }}>
          <MarketDisclaimer variant="login" />
        </Box>
      </Box>
    </Box>
  );
}

export default LoginPage;
