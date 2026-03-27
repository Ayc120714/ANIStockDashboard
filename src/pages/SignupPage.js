import React, { useMemo, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, TextField, Typography } from '@mui/material';
import { useNavigate } from 'react-router';
import { signup, validateEmail } from '../api/auth';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    mobile: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailHint, setEmailHint] = useState('');
  const [existingUser, setExistingUser] = useState(false);
  const [submittedMessage, setSubmittedMessage] = useState('');

  const canSubmit = useMemo(() => {
    const em = (form.email || '').trim();
    const digits = (form.mobile || '').replace(/\D/g, '');
    const mobileOk = !digits || (digits.length >= 8 && digits.length <= 15);
    return Boolean(em && emailRegex.test(em) && mobileOk);
  }, [form]);
  const authInputSx = {
    '& .MuiInputBase-input': { color: '#0f172a', fontWeight: 500 },
    '& .MuiFormLabel-root': { color: '#334155' },
    '& .MuiFormHelperText-root': { color: '#64748b' },
  };

  const onChange = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const checkEmail = async () => {
    if (!emailRegex.test(form.email.trim())) {
      setEmailHint('Email format is invalid.');
      return;
    }
    try {
      const res = await validateEmail(form.email.trim());
      if (res?.is_valid) {
        setEmailHint('Email looks valid.');
      } else {
        setEmailHint(res?.message || 'Email validation failed.');
      }
    } catch (err) {
      setEmailHint(err?.message || 'Email validation failed.');
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    setExistingUser(false);
    setSubmittedMessage('');
    try {
      const res = await signup({
        full_name: form.full_name,
        email: form.email.trim(),
        ...(form.mobile.replace(/\D/g, '') ? { mobile: form.mobile.replace(/\D/g, '') } : {}),
      });
      setSubmittedMessage(
        res?.message
          || 'Registration received. You will receive an email with setup instructions after an administrator approves your account.',
      );
    } catch (err) {
      const msg = err?.message || 'Signup failed.';
      setError(msg);
      if ((msg || '').toLowerCase().includes('already exists')) {
        setExistingUser(true);
      }
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
      <Box
        sx={{
          width: '100%',
          maxWidth: 980,
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: '1.05fr 1fr' },
        }}
      >
        <Card
          sx={{
            borderRadius: 3,
            border: '1px solid rgba(30, 64, 175, 0.22)',
            boxShadow: '0 22px 54px rgba(30, 64, 175, 0.18)',
            background: 'linear-gradient(145deg, rgba(2,6,23,0.86), rgba(15,23,42,0.74))',
            color: '#e2e8f0',
          }}
        >
          <CardContent sx={{ p: 3 }}>
            <Typography sx={{ color: '#93c5fd', fontSize: 13, fontWeight: 800, letterSpacing: 0.7, mb: 0.8 }}>
              START STRONG
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>
              Join the Trading Dashboard
            </Typography>
            <Typography sx={{ color: '#cbd5e1', mb: 2 }}>
              Create your secure account to unlock market insights, watchlists, and broker-ready execution workflows.
            </Typography>
            <Box sx={{ display: 'grid', gap: 1 }}>
              <Typography sx={{ color: '#bfdbfe' }}>- Real-time signals and alerts</Typography>
              <Typography sx={{ color: '#bfdbfe' }}>- Personalized watchlist tracking</Typography>
              <Typography sx={{ color: '#bfdbfe' }}>- Admin approval before access</Typography>
              <Typography sx={{ color: '#bfdbfe' }}>- Set your password from the approval email link</Typography>
            </Box>
          </CardContent>
        </Card>

        <Card
          sx={{
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
            <Typography variant="h5" sx={{ fontWeight: 800 }}>Create Account</Typography>
            <Typography variant="body2" sx={{ opacity: 0.92 }}>
              Register — access after admin approval
            </Typography>
          </Box>
          <CardContent sx={{ p: 3 }}>
            {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
            {submittedMessage ? (
              <Alert severity="success" sx={{ mb: 2 }}>
                {submittedMessage}
              </Alert>
            ) : null}
            {existingUser ? (
              <Alert severity="info" sx={{ mb: 2 }}>
                Account already exists. Please login or use forgot password.
              </Alert>
            ) : null}
            {emailHint ? <Alert severity={emailHint.includes('valid') ? 'success' : 'info'} sx={{ mb: 2 }}>{emailHint}</Alert> : null}
            {submittedMessage ? (
              <Button
                variant="contained"
                onClick={() => navigate('/login')}
                sx={{
                  py: 1.1,
                  textTransform: 'none',
                  fontWeight: 800,
                  backgroundColor: '#1d4ed8',
                  '&:hover': { backgroundColor: '#1e40af' },
                }}
              >
                Go to login
              </Button>
            ) : null}
            {!submittedMessage ? (
            <Box component="form" autoComplete="off" onSubmit={onSubmit} sx={{ display: 'grid', gap: 1.2 }}>
              <TextField
                label="Full name"
                value={form.full_name}
                onChange={onChange('full_name')}
                size="small"
                name="signup_full_name_no_autofill"
                autoComplete="off"
                inputProps={{ autoComplete: 'off' }}
                sx={authInputSx}
              />
              <TextField
                label="Email"
                value={form.email}
                onChange={onChange('email')}
                size="small"
                name="signup_email_no_autofill"
                autoComplete="off"
                inputProps={{ autoComplete: 'off' }}
                sx={authInputSx}
              />
              <TextField
                label="Mobile (optional)"
                value={form.mobile}
                onChange={onChange('mobile')}
                size="small"
                name="signup_mobile_no_autofill"
                autoComplete="off"
                inputProps={{ inputMode: 'tel', maxLength: 20, autoComplete: 'off' }}
                helperText="8–15 digits with country code if provided; or leave blank"
                sx={authInputSx}
              />
              <Button variant="text" onClick={checkEmail} sx={{ justifyContent: 'flex-start', p: 0, textTransform: 'none', fontWeight: 700, color: '#1d4ed8' }}>
                Validate email
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={!canSubmit || loading}
                sx={{
                  py: 1.1,
                  textTransform: 'none',
                  fontWeight: 800,
                  backgroundColor: '#1d4ed8',
                  '&:hover': { backgroundColor: '#1e40af' },
                  '&.Mui-disabled': { backgroundColor: '#cbd5e1', color: '#64748b' },
                }}
              >
                {loading ? 'Creating account...' : 'Submit registration'}
              </Button>
              <Button variant="text" onClick={() => navigate('/login')} sx={{ textTransform: 'none', fontWeight: 700, color: '#1d4ed8' }}>
                Already have an account? Login
              </Button>
              {existingUser ? (
                <Button variant="text" onClick={() => navigate('/forgot-password')} sx={{ textTransform: 'none', fontWeight: 700, color: '#1d4ed8' }}>
                  Forgot password? Reset now
                </Button>
              ) : null}
            </Box>
            ) : null}
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}

export default SignupPage;
