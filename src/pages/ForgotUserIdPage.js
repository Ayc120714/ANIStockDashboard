import React, { useMemo, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, TextField, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { forgotUserId } from '../api/auth';

function ForgotUserIdPage() {
  const navigate = useNavigate();
  const [mobile, setMobile] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const canSubmit = useMemo(() => (mobile || '').replace(/\D/g, '').length >= 10, [mobile]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await forgotUserId(mobile);
      const displayEmail = res?.email || res?.masked_email || '';
      setMessage(displayEmail ? `Your registered User ID (email): ${displayEmail}` : 'User ID sent.');
    } catch (err) {
      setError(err?.message || 'Unable to recover user ID.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, background: '#f5f7fb' }}>
      <Card sx={{ width: '100%', maxWidth: 440 }}>
        <CardContent>
          <Typography variant="h5" sx={{ mb: 2 }}>Forgot User ID</Typography>
          <Typography variant="body2" sx={{ color: '#666', mb: 2 }}>
            Enter your registered mobile number to recover your login email.
          </Typography>
          {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
          {message ? <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert> : null}
          <Box component="form" onSubmit={onSubmit} sx={{ display: 'grid', gap: 1.2 }}>
            <TextField
              label="Registered Mobile"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              size="small"
            />
            <Button type="submit" variant="contained" disabled={!canSubmit || loading}>
              {loading ? 'Checking...' : 'Recover User ID'}
            </Button>
            <Button variant="text" onClick={() => navigate('/login')} sx={{ textTransform: 'none' }}>
              Back to Login
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

export default ForgotUserIdPage;
