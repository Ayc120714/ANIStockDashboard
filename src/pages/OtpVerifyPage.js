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
  const requestedChannels = Array.isArray(location.state?.requires) && location.state.requires.length
    ? location.state.requires
    : (purpose === 'login_email' ? ['email'] : ['email', 'mobile']);

  const [emailOtp, setEmailOtp] = useState('');
  const [mobileOtp, setMobileOtp] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [mobileVerified, setMobileVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [trustDevice, setTrustDevice] = useState(true);
  const isEmailOnlyFlow = purpose === 'login_email';
  const requiresMobile = requestedChannels.includes('mobile') && !isEmailOnlyFlow;

  const canSubmitEmail = useMemo(() => flowId && purpose && emailOtp.length >= 4, [flowId, purpose, emailOtp]);
  const canSubmitMobile = useMemo(() => flowId && purpose && mobileOtp.length >= 4, [flowId, purpose, mobileOtp]);
  const verificationReady = emailVerified && (!requiresMobile || mobileVerified);

  const onVerify = async (channel) => {
    const otpCode = channel === 'email' ? emailOtp : mobileOtp;
    if (!flowId || !purpose || !otpCode) return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      await verifyOtp(flowId, purpose, channel, otpCode);
      if (channel === 'email') setEmailVerified(true);
      if (channel === 'mobile') setMobileVerified(true);
      setMessage(`${channel === 'email' ? 'Email' : 'Mobile'} OTP verified.`);
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
      setMessage(`${channel === 'email' ? 'Email' : 'Mobile'} OTP resent.`);
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
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, background: '#f5f7fb' }}>
        <Card sx={{ width: '100%', maxWidth: 480 }}>
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
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, background: '#f5f7fb' }}>
      <Card sx={{ width: '100%', maxWidth: 520 }}>
        <CardContent>
          <Typography variant="h5" sx={{ mb: 1.5 }}>Verify OTP</Typography>
          <Typography variant="body2" sx={{ color: '#666', mb: 2 }}>
            {!requiresMobile
              ? 'Enter the OTP sent to your email to continue.'
              : 'Verify both Email OTP and Mobile OTP to continue.'}
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
            />
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                onClick={() => onVerify('email')}
                disabled={!canSubmitEmail || loading || emailVerified}
              >
                Verify Email OTP
              </Button>
              <Button
                variant="outlined"
                onClick={() => onResend('email')}
                disabled={loading || emailVerified}
              >
                Resend Email OTP
              </Button>
            </Box>
          </Box>

          {requiresMobile ? (
            <Box sx={{ display: 'grid', gap: 1.5, mb: 2 }}>
              <TextField
                size="small"
                label="Mobile OTP"
                value={mobileOtp}
                onChange={(e) => setMobileOtp(onlyDigits(e.target.value))}
                disabled={mobileVerified}
                helperText={mobileVerified ? 'Mobile OTP verified' : 'Enter OTP sent to your mobile'}
              />
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  onClick={() => onVerify('mobile')}
                  disabled={!canSubmitMobile || loading || mobileVerified}
                >
                  Verify Mobile OTP
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => onResend('mobile')}
                  disabled={loading || mobileVerified}
                >
                  Resend Mobile OTP
                </Button>
              </Box>
            </Box>
          ) : null}

          <Button
            variant="contained"
            color="success"
            onClick={onContinue}
            disabled={!verificationReady || loading}
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
          />
        </CardContent>
      </Card>
    </Box>
  );
}

export default OtpVerifyPage;
