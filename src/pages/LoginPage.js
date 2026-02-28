import React, { useMemo, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, TextField, Typography } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import { adminPasswordlessLogin, loginStart, loginWithEmailOtpStart } from '../api/auth';
import { useAuth } from '../auth/AuthContext';

const DEFAULT_ADMIN_EMAIL = 'gvc1990@gmail.com';

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { persistAuth } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
        navigate(location.state?.from?.pathname || '/', { replace: true });
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
      navigate(location.state?.from?.pathname || '/', { replace: true });
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
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, background: '#f5f7fb' }}>
      <Card sx={{ width: '100%', maxWidth: 440 }}>
        <CardContent>
          <Typography variant="h5" sx={{ mb: 2 }}>Login</Typography>
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
              <Button type="submit" variant="contained" disabled={!canSubmit || loading}>
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
  );
}

export default LoginPage;
