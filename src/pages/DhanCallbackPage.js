import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Paper, Typography } from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { connectDhan, ensureDhanSession } from '../api/dhan';
import { markConsentLimitForToday, shouldSkipBrokerConsentToday } from '../auth/postLoginRouting';

const DHAN_DAILY_CONSENT_LIMIT = 25;

function DhanCallbackPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const hardWatchdog = setTimeout(() => {
      if (!mounted) return;
      setError('Dhan callback timed out. Please retry login once.');
      setLoading(false);
    }, 22000);

    const run = async () => {
      const withTimeout = async (promise, timeoutMs, label) => {
        let timeoutId;
        try {
          const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error(`${label} timed out. Please retry.`)), timeoutMs);
          });
          return await Promise.race([promise, timeoutPromise]);
        } finally {
          if (timeoutId) clearTimeout(timeoutId);
        }
      };

      const userId = String(user?.id || user?.user_id || user?.email || '');
      const tokenId = String(searchParams.get('tokenId') || searchParams.get('tokenid') || '').trim();
      const targetPath = decodeURIComponent(String(searchParams.get('from') || '').trim() || '/');
      if (!userId) {
        if (mounted) {
          setError('Session missing. Please login again and retry broker connect.');
          setLoading(false);
        }
        return;
      }

      try {
        const draftRaw = localStorage.getItem(`broker_integration_draft_${userId}_dhan`) || '{}';
        const draft = JSON.parse(draftRaw);
        const draftClientId = String(draft?.client_id || '').trim();
        const draftApiKey = String(draft?.credentials?.api_key || '').trim();
        const draftApiSecret = String(draft?.credentials?.api_secret || '').trim();

        if (!tokenId) {
          if (shouldSkipBrokerConsentToday(userId)) {
            navigate(targetPath || '/', { replace: true, state: { brokerConsentLimited: true } });
            return;
          }
          // Reuse pending consent URL first to avoid consuming extra daily attempts on retries.
          try {
            const existingPendingRaw = sessionStorage.getItem(`dhan_pending_connect_${userId}`) || '{}';
            const existingPending = JSON.parse(existingPendingRaw);
            const existingLoginUrl = String(existingPending?.login_url || '').trim();
            const existingCreatedAt = Number(existingPending?.created_at || 0);
            const isFreshPending = existingLoginUrl && (
              !existingCreatedAt || (Date.now() - existingCreatedAt) < (30 * 60 * 1000)
            );
            if (isFreshPending) {
              window.location.assign(existingLoginUrl);
              return;
            }
          } catch (_) {
            // continue with normal flow
          }

          // Prefer existing valid broker session to avoid unnecessary consent churn.
          try {
            const ensured = await withTimeout(
              ensureDhanSession({ user_id: userId }),
              12000,
              'Dhan session check'
            );
            if (ensured?.connected) {
              localStorage.setItem(`broker_session_auth_${userId}_dhan`, String(Date.now()));
              sessionStorage.removeItem(`dhan_pending_connect_${userId}`);
              navigate(targetPath || '/', { replace: true });
              return;
            }
          } catch (_) {
            // Continue with consent flow when no active reusable session exists.
          }

          // Start clean every time Step 1 is initiated.
          sessionStorage.removeItem(`dhan_pending_connect_${userId}`);

          // STEP 1: Backend generates consent and returns Dhan login URL.
          const connectRes = await withTimeout(
            connectDhan({
              user_id: userId,
              client_id: draftClientId,
              api_key: draftApiKey,
              api_secret: draftApiSecret,
            }),
            15000,
            'Dhan Step 1'
          );
          if (connectRes?.requires_token_id && connectRes?.login_url) {
            sessionStorage.setItem(
              `dhan_pending_connect_${userId}`,
              JSON.stringify({
                login_url: String(connectRes?.login_url || '').trim(),
                client_id: draftClientId,
                api_key: draftApiKey,
                api_secret: draftApiSecret,
                from: targetPath || '/',
                created_at: Date.now(),
              })
            );
            window.location.assign(connectRes.login_url);
            return;
          }
          throw new Error('Dhan Step 1 failed: backend did not return login URL.');
        }

        const pendingRaw = sessionStorage.getItem(`dhan_pending_connect_${userId}`) || '{}';
        const pending = JSON.parse(pendingRaw);
        const pendingTargetPath = String(pending?.from || targetPath || '/').trim() || '/';
        const pendingClientId = String(pending?.client_id || draftClientId || '').trim();
        const pendingApiKey = String(pending?.api_key || draftApiKey || '').trim();
        const pendingApiSecret = String(pending?.api_secret || draftApiSecret || '').trim();

        // STEP 3: backend consumes tokenId and returns access token.
        await withTimeout(
          connectDhan({
            user_id: userId,
            client_id: pendingClientId,
            api_key: pendingApiKey,
            api_secret: pendingApiSecret,
            token_id: tokenId,
          }),
          20000,
          'Dhan Step 3'
        );

        localStorage.setItem(`broker_session_auth_${userId}_dhan`, String(Date.now()));
        sessionStorage.removeItem(`dhan_pending_connect_${userId}`);
        navigate(pendingTargetPath, { replace: true });
      } catch (e) {
        if (mounted) {
          const msg = String(e?.message || '');
          if (msg.toUpperCase().includes('CONSENT_LIMIT_EXCEED') || msg.toLowerCase().includes('consent limit')) {
            markConsentLimitForToday(userId);
          }
          if (msg.toUpperCase().includes('CONSENT_LIMIT_EXCEED') || msg.toLowerCase().includes('consent limit')) {
            navigate(targetPath || '/', { replace: true, state: { brokerConsentLimited: true } });
            return;
          }
          setError(e?.message || 'Failed to complete Dhan login (Step 3 token exchange).');
          setLoading(false);
        }
      }
    };

    run();
    return () => {
      mounted = false;
      clearTimeout(hardWatchdog);
    };
  }, [navigate, searchParams, user]);

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Paper sx={{ width: '100%', maxWidth: 560, p: 3 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>Dhan Callback</Typography>
        {loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={20} />
            <Typography sx={{ fontSize: 14 }}>Finalizing broker session...</Typography>
          </Box>
        ) : null}
        {error ? <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert> : null}
        <Alert severity="info" sx={{ mt: 1.5 }}>
          Dhan consent login limit is {DHAN_DAILY_CONSENT_LIMIT} times per day.
        </Alert>
        {!loading ? (
          <Button sx={{ mt: 1.5, textTransform: 'none' }} variant="contained" onClick={() => navigate('/profile', { replace: true })}>
            Back to Profile
          </Button>
        ) : null}
      </Paper>
    </Box>
  );
}

export default DhanCallbackPage;
