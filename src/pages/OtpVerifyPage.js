import React, { useMemo, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Checkbox, FormControlLabel, TextField, Typography } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import { completeEmailOtpLogin, completeLogin, completeSignup, resendOtp, verifyOtp } from '../api/auth';
import { fetchBrokerSetup } from '../api/brokers';
import { routeAfterLogin } from '../auth/postLoginRouting';
import { useAuth } from '../auth/AuthContext';

const onlyDigits = (value) => (value || '').replace(/\D/g, '').slice(0, 8);

function OtpVerifyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { persistAuth } = useAuth();
  const flowId = location.state?.flowId || '';
  const purpose = location.state?.purpose || '';
  const from = location.state?.from || '/';

  const [emailOtp, setEmailOtp] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [trustDevice, setTrustDevice] = useState(true);

  const canSubmitEmail = useMemo(() => flowId && purpose && emailOtp.length >= 4, [flowId, purpose, emailOtp]);
  const verificationReady = emailVerified;

  const onVerify = async (channel) => {
    const otpCode = emailOtp;
    if (!flowId || !purpose || !otpCode) return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      await verifyOtp(flowId, purpose, channel, otpCode);
      if (channel === 'email') setEmailVerified(true);
      setMessage('Email OTP verified.');
    } catch (err) {
      setError(err?.message || `Failed to verify ${channel} OTP.`);
    } finally {
      setLoading(false);
    }
  };

  const onResend = async (channel) => {
    if (!flowId || !purpose) return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      await resendOtp(flowId, purpose, channel);
      setMessage('Email OTP resent.');
    } catch (err) {
      setError(err?.message || `Failed to resend ${channel} OTP.`);
    } finally {
      setLoading(false);
    }
  };

  const onContinue = async () => {
    if (!verificationReady || !flowId) return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      if (purpose === 'signup') {
        const res = await completeSignup(flowId, trustDevice);
        persistAuth(res?.access_token, res?.refresh_token, res?.user || null);
        const fallbackPath = from || '/';
        const userId = String(res?.user?.id || res?.user?.user_id || res?.user?.email || '');
        try {
          if (userId) {
            const rows = await fetchBrokerSetup({ userId });
            const hasSession = (Array.isArray(rows) ? rows : []).some((r) => Boolean(r?.has_session));
            if (!hasSession) {
              navigate('/profile', {
                replace: true,
                state: { openBrokerSetup: true, from: fallbackPath, showTelegramBotInfo: true },
              });
              return;
            }
          }
        } catch (_) {
          // continue to fallback path
        }
        navigate(fallbackPath, { replace: true, state: { showTelegramBotInfo: true } });
        return;
      }
      if (purpose === 'login_email') {
        const res = await completeEmailOtpLogin(flowId, trustDevice);
        persistAuth(res?.access_token, res?.refresh_token, res?.user || null);
        await routeAfterLogin({
          nextUser: res?.user || null,
          fallbackPath: from || '/',
          navigate,
        });
        return;
      }
      const res = await completeLogin(flowId, trustDevice);
      persistAuth(res?.access_token, res?.refresh_token, res?.user || null);
      await routeAfterLogin({
        nextUser: res?.user || null,
        fallbackPath: from || '/',
        navigate,
      });
    } catch (err) {
      setError(err?.message || 'Unable to complete login.');
    } finally {
      setLoading(false);
    }
  };

  if (!flowId || !purpose) {
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
        <Card
          sx={{
            width: '100%',
            maxWidth: 480,
            borderRadius: 3,
            boxShadow: '0 20px 48px rgba(30, 64, 175, 0.18)',
            border: '1px solid rgba(30, 64, 175, 0.2)',
          }}
        >
          <CardContent>
            <Alert severity="warning" sx={{ mb: 2 }}>
              OTP session is missing or expired. Start again from login or signup.
            </Alert>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button variant="contained" onClick={() => navigate('/login')}>Go to Login</Button>
              <Button variant="outlined" onClick={() => navigate('/signup')}>Go to Signup</Button>
            </Box>
          </CardContent>
        </Card>
      </Box>
    );
  }

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
      <Card
        sx={{
          width: '100%',
          maxWidth: 540,
          borderRadius: 3,
          boxShadow: '0 20px 56px rgba(30, 64, 175, 0.2)',
          overflow: 'hidden',
          border: '1px solid rgba(30, 64, 175, 0.2)',
          backgroundColor: '#ffffff',
        }}
      >
        <Box
          sx={{
            px: 3,
            py: 2,
            color: '#fff',
            background: 'linear-gradient(110deg, #1d4ed8 0%, #0ea5e9 100%)',
          }}
        >
          <Typography variant="h5" sx={{ fontWeight: 800 }}>Verify OTP</Typography>
          <Typography variant="body2" sx={{ opacity: 0.92 }}>
            Secure sign-in with email verification
          </Typography>
        </Box>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="body2" sx={{ color: '#475569', mb: 2 }}>
            Enter the OTP sent to your email to continue.
          </Typography>
          {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
          {message ? <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert> : null}

          <Box sx={{ display: 'grid', gap: 1.5, mb: 2 }}>
            <TextField
              size="small"
              label="Email OTP"
              value={emailOtp}
              onChange={(e) => setEmailOtp(onlyDigits(e.target.value))}
              disabled={emailVerified}
              helperText={emailVerified ? 'Email OTP verified' : 'Enter OTP sent to your email'}
              sx={{
                '& .MuiInputBase-input': { color: '#0f172a', fontWeight: 500 },
                '& .MuiFormLabel-root': { color: '#334155' },
                '& .MuiFormHelperText-root': { color: '#64748b' },
              }}
            />
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                onClick={() => onVerify('email')}
                disabled={!canSubmitEmail || loading || emailVerified}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  backgroundColor: '#1d4ed8',
                  '&:hover': { backgroundColor: '#1e40af' },
                  '&.Mui-disabled': { backgroundColor: '#cbd5e1', color: '#64748b' },
                }}
              >
                Verify Email OTP
              </Button>
              <Button
                variant="outlined"
                onClick={() => onResend('email')}
                disabled={loading || emailVerified}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  color: '#1d4ed8',
                  borderColor: '#2563eb',
                  '&:hover': { borderColor: '#1e40af', backgroundColor: '#eff6ff' },
                  '&.Mui-disabled': { borderColor: '#cbd5e1', color: '#94a3b8' },
                }}
              >
                Resend Email OTP
              </Button>
            </Box>
          </Box>

          <Button
            variant="contained"
            color="success"
            onClick={onContinue}
            disabled={!verificationReady || loading}
            sx={{
              textTransform: 'none',
              fontWeight: 800,
              mt: 0.5,
              px: 2.5,
              backgroundColor: '#16a34a',
              '&:hover': { backgroundColor: '#15803d' },
              '&.Mui-disabled': { backgroundColor: '#cbd5e1', color: '#64748b' },
            }}
          >
            {purpose === 'signup' ? 'Finish Signup' : 'Complete Login'}
          </Button>
          <FormControlLabel
            control={
              <Checkbox
                checked={trustDevice}
                onChange={(e) => setTrustDevice(e.target.checked)}
              />
            }
            label="Trust this device for 7 days (skip OTP on next login)"
            sx={{ mt: 1, '& .MuiFormControlLabel-label': { color: '#1e293b' } }}
          />
        </CardContent>
      </Card>
    </Box>
  );
}

export default OtpVerifyPage;
