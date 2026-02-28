import React, { useMemo, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, TextField, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { signup, validateEmail } from '../api/auth';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    mobile: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailHint, setEmailHint] = useState('');
  const [existingUser, setExistingUser] = useState(false);

  const canSubmit = useMemo(() => {
    return form.email && form.mobile && strongPasswordRegex.test(form.password || '');
  }, [form]);

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
    try {
      const res = await signup({
        full_name: form.full_name,
        email: form.email.trim(),
        mobile: form.mobile.trim(),
        password: form.password,
      });
      navigate('/verify-otp', {
        state: {
          flowId: res?.flow_id,
          purpose: 'signup',
          requires: res?.requires || ['email'],
          email: res?.email || form.email.trim(),
          mobile: res?.mobile || form.mobile.trim(),
        },
      });
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
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, background: '#f5f7fb' }}>
      <Card sx={{ width: '100%', maxWidth: 460 }}>
        <CardContent>
          <Typography variant="h5" sx={{ mb: 2 }}>Create Account</Typography>
          {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
          {existingUser ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              Account already exists. Please login or use forgot password.
            </Alert>
          ) : null}
          {emailHint ? <Alert severity={emailHint.includes('valid') ? 'success' : 'info'} sx={{ mb: 2 }}>{emailHint}</Alert> : null}
          <Box component="form" onSubmit={onSubmit} sx={{ display: 'grid', gap: 1.2 }}>
            <TextField label="Full name" value={form.full_name} onChange={onChange('full_name')} size="small" />
            <TextField label="Email" value={form.email} onChange={onChange('email')} size="small" />
            <Button variant="text" onClick={checkEmail} sx={{ justifyContent: 'flex-start', p: 0, textTransform: 'none' }}>
              Validate email
            </Button>
            <TextField label="Mobile" value={form.mobile} onChange={onChange('mobile')} size="small" />
            <TextField
              label="Password"
              type="password"
              value={form.password}
              onChange={onChange('password')}
              size="small"
              helperText="Min 8 chars with uppercase, lowercase, number and special character"
            />
            <Button type="submit" variant="contained" disabled={!canSubmit || loading}>
              {loading ? 'Creating account...' : 'Sign up and send OTP'}
            </Button>
            <Button variant="text" onClick={() => navigate('/login')} sx={{ textTransform: 'none' }}>
              Already have an account? Login
            </Button>
            {existingUser ? (
              <Button variant="text" onClick={() => navigate('/forgot-password')} sx={{ textTransform: 'none' }}>
                Forgot password? Reset now
              </Button>
            ) : null}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

export default SignupPage;
