import React, { useMemo, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, TextField, Typography } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import { adminPasswordlessLogin, loginStart, loginWithEmailOtpStart } from '../api/auth';
import { clearConsentLimitMarkersToday, hasAnyConsentLimitMarkerToday, routeAfterLogin } from '../auth/postLoginRouting';
import { useAuth } from '../auth/AuthContext';

const DEFAULT_ADMIN_EMAIL = 'gvc1990@gmail.com';
const AYC_LOGO_PATH = '/ayc-logo.png';

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { persistAuth } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showConsentInfo, setShowConsentInfo] = useState(() =>
    hasAnyConsentLimitMarkerToday() || Boolean(location.state?.brokerConsentLimited)
  );

  const canSubmit = useMemo(
    () => email.trim().length > 0 && password.length >= 8,
    [email, password]
  );
  const canEmailOtp = useMemo(() => email.trim().length > 4, [email]);
  const canPasswordlessAdminLogin = useMemo(
    () => email.trim().toLowerCase() === DEFAULT_ADMIN_EMAIL,
    [email]
  );
  const showPasswordField = !canPasswordlessAdminLogin;

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    try {
      const res = await loginStart(email.trim(), password);
      if (res?.mfa_required === false && res?.access_token && res?.refresh_token) {
        persistAuth(res.access_token, res.refresh_token, res?.user || null);
        await routeAfterLogin({
          nextUser: res?.user || null,
          fallbackPath: location.state?.from?.pathname || '/',
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
          from: location.state?.from?.pathname || '/',
        },
      });
    } catch (err) {
      setError(err?.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const onAdminPasswordlessLogin = async () => {
    if (!canPasswordlessAdminLogin) return;
    setLoading(true);
    setError('');
    try {
      const res = await adminPasswordlessLogin(email.trim());
      persistAuth(res?.access_token, res?.refresh_token, res?.user || null);
      await routeAfterLogin({
        nextUser: res?.user || null,
        fallbackPath: location.state?.from?.pathname || '/',
        navigate,
      });
    } catch (err) {
      setError(err?.message || 'Admin passwordless login failed.');
    } finally {
      setLoading(false);
    }
  };

  const onEmailOtpLogin = async () => {
    if (!canEmailOtp) return;
    setLoading(true);
    setError('');
    try {
      const res = await loginWithEmailOtpStart(email.trim());
      navigate('/verify-otp', {
        state: {
          flowId: res?.flow_id,
          purpose: 'login_email',
          requires: res?.requires || ['email'],
          email: email.trim(),
          from: location.state?.from?.pathname || '/',
        },
      });
    } catch (err) {
      setError(err?.message || 'Unable to send email OTP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        p: { xs: 2, md: 4 },
        background: 'radial-gradient(circle at 15% 20%, #1d4ed8 0%, #0b1630 45%, #060b19 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Box
        sx={{
          width: '100%',
          maxWidth: 1220,
          display: 'grid',
          gap: 2.5,
          gridTemplateColumns: { xs: '1fr', md: '1.1fr 0.9fr' },
        }}
      >
        <Card
          sx={{
            p: { xs: 2.2, md: 3.5 },
            borderRadius: 3,
            color: '#e8efff',
            background: 'linear-gradient(135deg, rgba(12,24,54,0.95), rgba(7,12,28,0.88))',
            boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
            border: '1px solid rgba(148,163,184,0.2)',
          }}
        >
          <Box
            component="img"
            src={AYC_LOGO_PATH}
            alt="AYC Industries"
            sx={{
              width: '100%',
              maxWidth: 560,
              objectFit: 'contain',
              mb: 1.5,
              filter: 'drop-shadow(0 10px 18px rgba(37,99,235,0.25))',
            }}
          />
          <Typography sx={{ color: '#93c5fd', fontWeight: 700, letterSpacing: 1.2, mb: 1 }}>
            ANALYZE • YIELD • CONQUER
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 1.2, lineHeight: 1.2 }}>
            Investor-grade intelligence platform
          </Typography>
          <Typography sx={{ color: '#cbd5e1', fontSize: 15, mb: 2.2, maxWidth: 640 }}>
            AYC Industries represents a modern vision of industrial and financial growth driven by
            intelligence, strategy, and performance. Turning insight into growth and strategy into success.
          </Typography>
          <Box sx={{ display: 'grid', gap: 1.1, gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' } }}>
            {[
              ['Analyze', 'Deep market research, signal intelligence, and data-led decisions.'],
              ['Yield', 'Focused execution for sustainable returns and long-term value creation.'],
              ['Conquer', 'Disciplined expansion, resilience, and leadership across markets.'],
            ].map(([title, text]) => (
              <Box
                key={title}
                sx={{
                  p: 1.4,
                  borderRadius: 2,
                  background: 'linear-gradient(180deg, rgba(30,64,175,0.30), rgba(15,23,42,0.45))',
                  border: '1px solid rgba(96,165,250,0.28)',
                }}
              >
                <Typography sx={{ fontWeight: 700, color: '#bfdbfe', mb: 0.5 }}>{title}</Typography>
                <Typography sx={{ fontSize: 12.5, color: '#dbeafe' }}>{text}</Typography>
              </Box>
            ))}
          </Box>
        </Card>

        <Card
          sx={{
            width: '100%',
            borderRadius: 3,
            background: 'linear-gradient(170deg, rgba(255,255,255,0.97), rgba(240,248,255,0.94))',
            boxShadow: '0 22px 45px rgba(5,10,28,0.35)',
            border: '1px solid rgba(59,130,246,0.22)',
          }}
        >
          <CardContent sx={{ p: { xs: 2.2, md: 3 } }}>
            <Typography variant="h5" sx={{ mb: 0.6, fontWeight: 800, color: '#0f172a' }}>
              Welcome Back
            </Typography>
            <Typography sx={{ mb: 2, color: '#475569', fontSize: 14 }}>
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
            <Box component="form" onSubmit={onSubmit} sx={{ display: 'grid', gap: 1.2 }}>
              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                size="small"
                autoComplete="email"
              />
              {showPasswordField ? (
                <TextField
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  size="small"
                  autoComplete="current-password"
                />
              ) : (
                <Alert severity="info">
                  Admin email detected. Use quick login below (no password/OTP).
                </Alert>
              )}
              {showPasswordField ? (
                <Button
                  type="submit"
                  variant="contained"
                  disabled={!canSubmit || loading}
                  sx={{ py: 1.1, fontWeight: 700, textTransform: 'none' }}
                >
                  {loading ? 'Sending OTP...' : 'Continue with OTP'}
                </Button>
              ) : null}
              <Button variant="outlined" onClick={onEmailOtpLogin} disabled={!canEmailOtp || loading}>
                Login with Email OTP
              </Button>
              {canPasswordlessAdminLogin ? (
                <Button variant="outlined" color="warning" onClick={onAdminPasswordlessLogin} disabled={loading}>
                  Admin Quick Login (No Password / OTP)
                </Button>
              ) : null}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                <Button variant="text" onClick={() => navigate('/forgot-user-id')} sx={{ textTransform: 'none', p: 0 }}>
                  Forgot User ID?
                </Button>
                <Button variant="text" onClick={() => navigate('/forgot-password')} sx={{ textTransform: 'none', p: 0 }}>
                  Forgot Password?
                </Button>
              </Box>
              <Button variant="text" onClick={() => navigate('/signup')} sx={{ textTransform: 'none' }}>
                New user? Sign up
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}

export default LoginPage;
