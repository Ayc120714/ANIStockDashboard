import React, { useMemo, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, TextField, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { forgotPasswordComplete, forgotPasswordStart, resendOtp, verifyOtp } from '../api/auth';

const onlyDigits = (value) => (value || '').replace(/\D/g, '').slice(0, 8);
const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [flowId, setFlowId] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [mobileOtp, setMobileOtp] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [mobileVerified, setMobileVerified] = useState(false);
  const [hint, setHint] = useState('');
  const [requires, setRequires] = useState(['email', 'mobile']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const canStart = useMemo(
    () => identifier.trim().length > 3 && strongPasswordRegex.test(newPassword || ''),
    [identifier, newPassword]
  );
  const canVerifyEmail = useMemo(() => flowId && emailOtp.length >= 4, [flowId, emailOtp]);
  const canVerifyMobile = useMemo(() => flowId && mobileOtp.length >= 4, [flowId, mobileOtp]);
  const requiresMobile = useMemo(() => requires.includes('mobile'), [requires]);
  const verificationReady = useMemo(
    () => emailVerified && (!requiresMobile || mobileVerified),
    [emailVerified, mobileVerified, requiresMobile]
  );

  const startReset = async (e) => {
    e.preventDefault();
    if (!canStart) return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await forgotPasswordStart(identifier.trim());
      setFlowId(res?.flow_id || '');
      const nextRequires = Array.isArray(res?.requires) && res.requires.length ? res.requires : ['email'];
      setRequires(nextRequires);
      setHint(
        nextRequires.includes('mobile')
          ? `OTP sent to ${res?.masked_email || 'registered email'} and ${res?.masked_mobile || 'registered mobile'}`
          : `OTP sent to ${res?.masked_email || 'registered email'}`
      );
      if (res?.debug_otp?.email || res?.debug_otp?.mobile) {
        setHint((prev) => `${prev}. Test OTPs: email=${res?.debug_otp?.email || '-'} mobile=${res?.debug_otp?.mobile || '-'}`);
      }
    } catch (err) {
      setError(err?.message || 'Unable to start password reset.');
    } finally {
      setLoading(false);
    }
  };

  const onVerify = async (channel) => {
    const code = channel === 'email' ? emailOtp : mobileOtp;
    if (!flowId || !code) return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      await verifyOtp(flowId, 'reset_password', channel, code);
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
    if (!flowId) return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await resendOtp(flowId, 'reset_password', channel);
      setMessage(`${channel === 'email' ? 'Email' : 'Mobile'} OTP resent.`);
      if (res?.debug_otp) {
        setMessage((prev) => `${prev} Test OTP: ${res.debug_otp}`);
      }
    } catch (err) {
      setError(err?.message || `Failed to resend ${channel} OTP.`);
    } finally {
      setLoading(false);
    }
  };

  const completeReset = async () => {
    if (!flowId || !verificationReady || !strongPasswordRegex.test(newPassword || '')) return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      await forgotPasswordComplete(flowId, newPassword);
      setMessage('Password reset successful. Please login with new password.');
      setTimeout(() => navigate('/login'), 700);
    } catch (err) {
      setError(err?.message || 'Unable to complete password reset.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, background: '#f5f7fb' }}>
      <Card sx={{ width: '100%', maxWidth: 560 }}>
        <CardContent>
          <Typography variant="h5" sx={{ mb: 2 }}>Forgot Password</Typography>
          {!flowId ? (
            <Box component="form" onSubmit={startReset} sx={{ display: 'grid', gap: 1.2 }}>
              <TextField
                label="Email or Mobile"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                size="small"
              />
              <TextField
                label="New Password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                size="small"
                helperText="Min 8 chars with uppercase, lowercase, number and special character"
              />
              <Button type="submit" variant="contained" disabled={!canStart || loading}>
                {loading ? 'Sending OTP...' : 'Send OTP for Reset'}
              </Button>
            </Box>
          ) : (
            <Box sx={{ display: 'grid', gap: 1.3 }}>
              {hint ? <Alert severity="info">{hint}</Alert> : null}
              <TextField
                size="small"
                label="Email OTP"
                value={emailOtp}
                onChange={(e) => setEmailOtp(onlyDigits(e.target.value))}
                disabled={emailVerified}
                helperText={emailVerified ? 'Email OTP verified' : 'Enter OTP sent to email'}
              />
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button variant="contained" disabled={!canVerifyEmail || loading || emailVerified} onClick={() => onVerify('email')}>
                  Verify Email OTP
                </Button>
                <Button variant="outlined" disabled={loading || emailVerified} onClick={() => onResend('email')}>
                  Resend Email OTP
                </Button>
              </Box>

              {requiresMobile ? (
                <>
                  <TextField
                    size="small"
                    label="Mobile OTP"
                    value={mobileOtp}
                    onChange={(e) => setMobileOtp(onlyDigits(e.target.value))}
                    disabled={mobileVerified}
                    helperText={mobileVerified ? 'Mobile OTP verified' : 'Enter OTP sent to mobile'}
                  />
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button variant="contained" disabled={!canVerifyMobile || loading || mobileVerified} onClick={() => onVerify('mobile')}>
                      Verify Mobile OTP
                    </Button>
                    <Button variant="outlined" disabled={loading || mobileVerified} onClick={() => onResend('mobile')}>
                      Resend Mobile OTP
                    </Button>
                  </Box>
                </>
              ) : null}

              <Button color="success" variant="contained" disabled={!verificationReady || loading} onClick={completeReset}>
                Reset Password
              </Button>
            </Box>
          )}

          {error ? <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert> : null}
          {message ? <Alert severity="success" sx={{ mt: 2 }}>{message}</Alert> : null}
          <Button variant="text" onClick={() => navigate('/login')} sx={{ mt: 1, textTransform: 'none' }}>
            Back to Login
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}

export default ForgotPasswordPage;
