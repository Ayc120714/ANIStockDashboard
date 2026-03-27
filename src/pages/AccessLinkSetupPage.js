import React, { useMemo, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, TextField, Typography } from '@mui/material';
import { useNavigate } from 'react-router';
import { useSearchParams } from 'react-router-dom';
import { completeAccessLinkSetup } from '../api/auth';
import { useAuth } from '../auth/AuthContext';

const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

function AccessLinkSetupPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { persistAuth } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
      setMessage('Password set successfully. Redirecting to dashboard...');
      setTimeout(() => navigate('/'), 700);
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
            Use your approved email link to activate account access.
          </Typography>
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
              type="password"
              size="small"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              helperText="Min 8 chars with uppercase, lowercase, number and special character"
            />
            <TextField
              label="Confirm Password"
              type="password"
              size="small"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
