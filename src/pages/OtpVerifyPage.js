import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Checkbox, FormControlLabel, TextField, Typography } from '@mui/material';
import { useLocation, useNavigate } from 'react-router';
import { completeEmailOtpLogin, completeLogin, completeSignup, resendOtp, verifyOtp } from '../api/auth';
import { fetchBrokerSetup, hasAnyBrokerLiveSession } from '../api/brokers';
import { routeAfterLogin } from '../auth/postLoginRouting';
import { useAuth } from '../auth/AuthContext';

const onlyDigits = (value) => (value || '').replace(/\D/g, '').slice(0, 8);
const OTP_FLOW_SESSION_KEY = 'auth_otp_flow_ctx';

function OtpVerifyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { persistAuth } = useAuth();
  let storedFlow = {};
  try {
    storedFlow = JSON.parse(sessionStorage.getItem(OTP_FLOW_SESSION_KEY) || '{}');
  } catch (_) {
    storedFlow = {};
  }
  const flowId = String(location.state?.flowId || storedFlow?.flowId || '').trim();
  const purpose = String(location.state?.purpose || storedFlow?.purpose || '').trim();
  const from = String(location.state?.from || storedFlow?.from || '/').trim() || '/';

  const [emailOtp, setEmailOtp] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [trustDevice, setTrustDevice] = useState(true);

  const canSubmitEmail = useMemo(() => flowId && purpose && emailOtp.length >= 4, [flowId, purpose, emailOtp]);
  const verificationReady = emailVerified;
  /** Password + email OTP (`login`) or passwordless email OTP (`login_email`). */
  const isEmailOtpLoginStep = purpose === 'login_email' || purpose === 'login';

  const clearOtpFlowSession = useCallback(() => {
    try {
      sessionStorage.removeItem(OTP_FLOW_SESSION_KEY);
    } catch (_) {
      // ignore storage failures
    }
  }, []);

  /** Exchange tokens and route (after OTP consumed for login flows). */
  const doCompleteLogin = useCallback(async () => {
    if (purpose === 'login_email') {
      const res = await completeEmailOtpLogin(flowId, trustDevice);
      persistAuth(res?.access_token, res?.refresh_token, res?.user || null);
      clearOtpFlowSession();
      await routeAfterLogin({
        nextUser: res?.user || null,
        fallbackPath: from || '/',
        navigate,
      });
      return;
    }
    if (purpose === 'login') {
      const res = await completeLogin(flowId, trustDevice);
      persistAuth(res?.access_token, res?.refresh_token, res?.user || null);
      clearOtpFlowSession();
      await routeAfterLogin({
        nextUser: res?.user || null,
        fallbackPath: from || '/',
        navigate,
      });
    }
  }, [flowId, purpose, trustDevice, from, navigate, persistAuth, clearOtpFlowSession]);

  const onVerify = async (channel) => {
    const otpCode = emailOtp;
    if (!flowId || !purpose || !otpCode) return;
    setLoading(true);
    setError('');
    setMessage('');
    let otpAccepted = false;
    try {
      await verifyOtp(flowId, purpose, channel, otpCode);
      if (channel === 'email') {
        setEmailVerified(true);
        otpAccepted = true;
      }

      if (purpose === 'signup') {
        setMessage('Email OTP verified. Finish signup below.');
        return;
      }

      if (purpose === 'login' || purpose === 'login_email') {
        setMessage('Signing you in…');
        await doCompleteLogin();
        setMessage('');
        return;
      }

      setMessage('Email OTP verified.');
    } catch (err) {
      setMessage('');
      setError(
        err?.message
          || (otpAccepted ? 'Unable to complete login.' : `Failed to verify ${channel} OTP.`)
      );
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

  const onFinishSignup = async () => {
    if (!verificationReady || !flowId || purpose !== 'signup') return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await completeSignup(flowId, trustDevice);
      if (res?.pending_approval) {
        setMessage(res?.message || 'Email verified. Await admin approval email link.');
        setError('');
        setTimeout(() => navigate('/login', { replace: true }), 1200);
        return;
      }
      persistAuth(res?.access_token, res?.refresh_token, res?.user || null);
      clearOtpFlowSession();
      const fallbackPath = from || '/';
      const userId = String(res?.user?.id || res?.user?.user_id || res?.user?.email || '');
      try {
        if (userId) {
          const rows = await fetchBrokerSetup({ userId });
          if (!hasAnyBrokerLiveSession(rows)) {
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
    } catch (err) {
      setMessage('');
      setError(err?.message || 'Unable to complete signup.');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (!flowId || !purpose) return;
    try {
      sessionStorage.setItem(
        OTP_FLOW_SESSION_KEY,
        JSON.stringify({
          flowId,
          purpose,
          from: from || '/',
          savedAt: Date.now(),
        })
      );
    } catch (_) {
      // ignore storage failures
    }
  }, [flowId, purpose, from]);

  /** If verify succeeded but token exchange failed, OTP is already used — retry complete only. */
  const onRetryCompleteLogin = async () => {
    if (!flowId || !isEmailOtpLoginStep || !emailVerified) return;
    setLoading(true);
    setError('');
    setMessage('Signing you in…');
    try {
      await doCompleteLogin();
      setMessage('');
    } catch (err) {
      setMessage('');
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
            {isEmailOtpLoginStep
              ? purpose === 'login'
                ? 'Enter the email OTP after your password'
                : 'Enter OTP sent to mail'
              : 'Secure sign-in with email verification'}
          </Typography>
        </Box>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="body2" sx={{ color: '#475569', mb: 2, fontWeight: isEmailOtpLoginStep ? 600 : 400 }}>
            {isEmailOtpLoginStep
              ? purpose === 'login'
                ? 'Enter the one-time code sent to your email to finish signing in.'
                : 'Enter OTP sent to mail.'
              : 'Enter the OTP sent to your email to continue.'}
          </Typography>
          {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
          {message ? (
            <Alert
              severity={message.includes('Signing') ? 'info' : 'success'}
              sx={{ mb: 2 }}
            >
              {message}
            </Alert>
          ) : null}

          <FormControlLabel
            control={
              <Checkbox
                checked={trustDevice}
                onChange={(e) => setTrustDevice(e.target.checked)}
                disabled={loading || (isEmailOtpLoginStep && emailVerified)}
              />
            }
            label="Trust this device for 7 days (skip OTP on next login)"
            sx={{ mb: 2, display: 'block', '& .MuiFormControlLabel-label': { color: '#1e293b' } }}
          />

          <Box sx={{ display: 'grid', gap: 1.5, mb: 2 }}>
            <TextField
              size="small"
              label="Email OTP"
              value={emailOtp}
              onChange={(e) => setEmailOtp(onlyDigits(e.target.value))}
              disabled={emailVerified}
              helperText={
                emailVerified
                  ? 'Email OTP verified'
                  : isEmailOtpLoginStep
                    ? purpose === 'login'
                      ? 'Code from email after password step'
                      : 'Enter OTP sent to mail'
                    : 'Enter OTP sent to your email'
              }
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

          {purpose === 'signup' ? (
            <Button
              variant="contained"
              color="success"
              onClick={onFinishSignup}
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
              Finish Signup
            </Button>
          ) : null}

          {isEmailOtpLoginStep && emailVerified && error ? (
            <Button
              variant="contained"
              color="success"
              onClick={onRetryCompleteLogin}
              disabled={loading}
              sx={{
                textTransform: 'none',
                fontWeight: 800,
                mt: 1,
                px: 2.5,
                backgroundColor: '#16a34a',
                '&:hover': { backgroundColor: '#15803d' },
              }}
            >
              Try signing in again
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </Box>
  );
}

export default OtpVerifyPage;
