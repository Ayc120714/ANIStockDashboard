import React, { useMemo, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, IconButton, InputAdornment, Link, TextField, Typography } from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { useNavigate } from 'react-router';
import { useSearchParams } from 'react-router-dom';
import { completeAccessLinkSetup } from '../api/auth';
import { useAuth } from '../auth/AuthContext';
import { routeAfterLogin } from '../auth/postLoginRouting';
import { TELEGRAM_BOT_LABEL, TELEGRAM_BOT_URL } from '../constants/telegram';

const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

function AccessLinkSetupPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { persistAuth, hydrateMe } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const flowId = String(params.get('flow_id') || '').trim();
  const token = String(params.get('token') || '').trim();
  const linkReady = Boolean(flowId && token);

  const canSubmit = useMemo(() => {
    return (
      linkReady
      && strongPasswordRegex.test(password || '')
      && password === confirmPassword
    );
  }, [linkReady, password, confirmPassword]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await completeAccessLinkSetup(flowId, token, password, true);
      if (!res?.access_token || !res?.refresh_token) {
        throw new Error('Access setup completed but login session is missing.');
      }
      persistAuth(res.access_token, res.refresh_token, res.user || null);
      await hydrateMe();
      setMessage('Password set successfully. Redirecting...');
      setTimeout(async () => {
        await routeAfterLogin({
          nextUser: res.user || null,
          fallbackPath: '/',
          navigate,
        });
      }, 700);
    } catch (err) {
      setError(err?.message || 'Unable to complete access setup.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
        background: 'radial-gradient(circle at 15% 20%, #1d4ed8 0%, #0b1630 45%, #060b19 100%)',
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 520, borderRadius: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
            Set Your Password
          </Typography>
          <Typography sx={{ color: '#475569', mb: 2 }}>
            Use the secure link from your approval email to set your password and sign in.
          </Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              After you log in, you can get market alerts on Telegram: open{' '}
              <Link href={TELEGRAM_BOT_URL} target="_blank" rel="noreferrer" fontWeight={700}>
                {TELEGRAM_BOT_LABEL}
              </Link>
              {' '}and send <strong>/start</strong>. An admin must approve your chat before alerts are sent.
            </Typography>
          </Alert>
          {!linkReady ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              Access link is missing required parameters. Ask admin to resend the link.
            </Alert>
          ) : null}
          {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
          {message ? <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert> : null}
          <Box component="form" onSubmit={onSubmit} sx={{ display: 'grid', gap: 1.2 }}>
            <TextField
              label="New Password"
              type={showPassword ? 'text' : 'password'}
              size="small"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              helperText="Min 8 chars with uppercase, lowercase, number and special character"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPassword((prev) => !prev)}
                      onMouseDown={(e) => e.preventDefault()}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              label="Confirm Password"
              type={showConfirmPassword ? 'text' : 'password'}
              size="small"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      onMouseDown={(e) => e.preventDefault()}
                      edge="end"
                    >
                      {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <Button
              type="submit"
              variant="contained"
              disabled={!canSubmit || loading}
              sx={{ textTransform: 'none', fontWeight: 700, py: 1.1 }}
            >
              {loading ? 'Setting password...' : 'Set password and continue'}
            </Button>
            <Button variant="text" onClick={() => navigate('/login')} sx={{ textTransform: 'none' }}>
              Back to login
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

export default AccessLinkSetupPage;
