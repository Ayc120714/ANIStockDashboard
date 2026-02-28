import React, { useMemo, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, TextField, Typography } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import { completeLogin, resendOtp, verifyOtp } from '../api/auth';
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
  const [mobileOtp, setMobileOtp] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [mobileVerified, setMobileVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const canSubmitEmail = useMemo(() => flowId && purpose && emailOtp.length >= 4, [flowId, purpose, emailOtp]);
  const canSubmitMobile = useMemo(() => flowId && purpose && mobileOtp.length >= 4, [flowId, purpose, mobileOtp]);
  const bothVerified = emailVerified && mobileVerified;

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
    if (!bothVerified || !flowId) return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      if (purpose === 'signup') {
        setMessage('Signup verification complete. Please login.');
        navigate('/login');
        return;
      }
      const res = await completeLogin(flowId);
      persistAuth(res?.access_token, res?.refresh_token, res?.user || null);
      navigate(from, { replace: true });
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
            Verify both Email OTP and Mobile OTP to continue.
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

          <Button
            variant="contained"
            color="success"
            onClick={onContinue}
            disabled={!bothVerified || loading}
          >
            {purpose === 'signup' ? 'Finish Signup' : 'Complete Login'}
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}

export default OtpVerifyPage;
