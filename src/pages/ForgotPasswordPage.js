import React, { useMemo, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, IconButton, InputAdornment, TextField, Typography } from '@mui/material';
import { MdVisibility, MdVisibilityOff } from 'react-icons/md';
import { useNavigate } from 'react-router';
import { forgotPasswordComplete, forgotPasswordStart, resendOtp, verifyOtp } from '../api/auth';

const onlyDigits = (value) => (value || '').replace(/\D/g, '').slice(0, 8);
const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [flowId, setFlowId] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [hint, setHint] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  const canStart = useMemo(
    () => identifier.trim().length > 3 && strongPasswordRegex.test(newPassword || ''),
    [identifier, newPassword]
  );
  const canVerifyEmail = useMemo(() => flowId && emailOtp.length >= 4, [flowId, emailOtp]);
  const verificationReady = useMemo(() => emailVerified, [emailVerified]);
  const authInputSx = {
    '& .MuiInputBase-input': { color: '#0f172a', fontWeight: 500 },
    '& .MuiFormLabel-root': { color: '#334155' },
    '& .MuiFormHelperText-root': { color: '#64748b' },
  };

  const startReset = async (e) => {
    e.preventDefault();
    if (!canStart) return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await forgotPasswordStart(identifier.trim());
      setFlowId(res?.flow_id || '');
      setHint(`OTP sent to ${res?.masked_email || 'registered email'}`);
    } catch (err) {
      setError(err?.message || 'Unable to start password reset.');
    } finally {
      setLoading(false);
    }
  };

  const onVerify = async (channel) => {
    const code = emailOtp;
    if (!flowId || !code) return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      await verifyOtp(flowId, 'reset_password', channel, code);
      if (channel === 'email') setEmailVerified(true);
      setMessage('Email OTP verified.');
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
      await resendOtp(flowId, 'reset_password', channel);
      setMessage('Email OTP resent.');
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
          maxWidth: 560,
          borderRadius: 3,
          boxShadow: '0 20px 56px rgba(30, 64, 175, 0.2)',
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
          <Typography variant="h5" sx={{ fontWeight: 800 }}>Forgot Password</Typography>
          <Typography variant="body2" sx={{ opacity: 0.92 }}>
            Reset securely with email OTP
          </Typography>
        </Box>
        <CardContent>
          {!flowId ? (
            <Box component="form" onSubmit={startReset} sx={{ display: 'grid', gap: 1.2 }}>
              <TextField
                label="Email or Mobile"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                size="small"
                sx={authInputSx}
              />
              <TextField
                label="New Password"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                size="small"
                helperText="Min 8 chars with uppercase, lowercase, number and special character"
                sx={authInputSx}
                autoComplete="new-password"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                        edge="end"
                        size="small"
                        onClick={() => setShowNewPassword((v) => !v)}
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        {showNewPassword ? <MdVisibilityOff size={22} /> : <MdVisibility size={22} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <Button
                type="submit"
                variant="contained"
                disabled={!canStart || loading}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  backgroundColor: '#1d4ed8',
                  '&:hover': { backgroundColor: '#1e40af' },
                  '&.Mui-disabled': { backgroundColor: '#cbd5e1', color: '#64748b' },
                }}
              >
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
                sx={authInputSx}
              />
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  disabled={!canVerifyEmail || loading || emailVerified}
                  onClick={() => onVerify('email')}
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
                  disabled={loading || emailVerified}
                  onClick={() => onResend('email')}
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

              <Button
                color="success"
                variant="contained"
                disabled={!verificationReady || loading}
                onClick={completeReset}
                sx={{
                  textTransform: 'none',
                  fontWeight: 800,
                  '&.Mui-disabled': { backgroundColor: '#cbd5e1', color: '#64748b' },
                }}
              >
                Reset Password
              </Button>
            </Box>
          )}

          {error ? <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert> : null}
          {message ? <Alert severity="success" sx={{ mt: 2 }}>{message}</Alert> : null}
          <Button variant="text" onClick={() => navigate('/login')} sx={{ mt: 1, textTransform: 'none', color: '#1d4ed8', fontWeight: 700 }}>
            Back to Login
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}

export default ForgotPasswordPage;
