import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import { useAuth } from '../../auth/AuthContext';
import { formatInboxPrice } from '../../utils/inboxAlertDetail';
import {
  buildProductProfilesFromAlertDetail,
  canShowAlertTradeActions,
  inferAlertSide,
  placeAlertTrade,
  productOptionsForSide,
  resolveActiveBroker,
} from '../../utils/alertTradeSetup';

function SetupLevels({ profile }) {
  return (
    <Stack spacing={0.25} sx={{ mt: 0.75 }}>
      <Typography variant="caption" color="text.secondary">
        Entry {formatInboxPrice(profile?.entryPrice)}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        SL {formatInboxPrice(profile?.stopLoss)}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        T1 {formatInboxPrice(profile?.target1)}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        T2 {formatInboxPrice(profile?.target2)}
      </Typography>
    </Stack>
  );
}

function AlertTradeActions({ detail }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = String(user?.id || user?.user_id || user?.email || '');
  const [side, setSide] = useState('BUY');
  const [broker, setBroker] = useState('dhan');
  const [busyProduct, setBusyProduct] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const profile = useMemo(
    () => (detail ? buildProductProfilesFromAlertDetail(detail) : null),
    [detail],
  );

  useEffect(() => {
    if (!detail) return;
    setSide(inferAlertSide(detail));
    setMessage('');
    setError('');
  }, [detail]);

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    resolveActiveBroker(userId)
      .then((b) => {
        if (!cancelled && b) setBroker(b);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!canShowAlertTradeActions(detail) || !profile) return null;

  const productOptions = productOptionsForSide(side);

  const handleTrade = async (productType) => {
    setBusyProduct(productType);
    setError('');
    setMessage('');
    try {
      const res = await placeAlertTrade({
        userId,
        broker,
        symbol: detail.symbol,
        side,
        productType,
        profile,
        qty: 1,
        marketPrice: detail.levels?.cmp ?? detail.levels?.entry,
      });
      const status = res?.data?.status || 'OK';
      const orderId = res?.data?.id || '—';
      setMessage(`${side} ${productType} order submitted (${status}) · Order#${orderId}`);
    } catch (e) {
      const msg = String(e?.message || e || 'Failed to place order');
      if (/session|broker|token|auth/i.test(msg)) {
        setError(`${msg} — validate your broker session in Profile.`);
      } else {
        setError(msg);
      }
    } finally {
      setBusyProduct('');
    }
  };

  return (
    <Box
      sx={{
        border: '1px solid rgba(16, 185, 129, 0.28)',
        borderRadius: 1.5,
        px: 1.5,
        py: 1.25,
        bgcolor: 'rgba(236, 253, 245, 0.75)',
      }}
    >
      <Typography variant="caption" sx={{ fontWeight: 800, color: '#047857', display: 'block', mb: 1 }}>
        Take trade
      </Typography>

      <Stack direction="row" spacing={1} sx={{ mb: 1.25 }}>
        <Button
          size="small"
          variant={side === 'BUY' ? 'contained' : 'outlined'}
          color="success"
          onClick={() => setSide('BUY')}
          sx={{ flex: 1, textTransform: 'none', fontWeight: 800 }}
        >
          Buy
        </Button>
        <Button
          size="small"
          variant={side === 'SELL' ? 'contained' : 'outlined'}
          color="error"
          onClick={() => setSide('SELL')}
          sx={{ flex: 1, textTransform: 'none', fontWeight: 800 }}
        >
          Sell
        </Button>
      </Stack>

      <Divider sx={{ mb: 1.25 }} />

      <Box
        sx={{
          display: 'grid',
          gap: 1,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
        }}
      >
        {productOptions.map((opt) => {
          const productProfile = profile.byProduct?.[opt.value] || {};
          const busy = busyProduct === opt.value;
          return (
            <Box
              key={opt.value}
              sx={{
                border: '1px solid rgba(148, 163, 184, 0.35)',
                borderRadius: 1.25,
                p: 1,
                bgcolor: '#fff',
              }}
            >
              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={0.5}>
                <Typography variant="body2" sx={{ fontWeight: 800 }}>
                  {opt.title}
                </Typography>
                <Chip size="small" label={opt.label} sx={{ fontSize: 10, height: 20, fontWeight: 700 }} />
              </Stack>
              <Typography variant="caption" color="text.secondary" display="block">
                {opt.hint}
              </Typography>
              <SetupLevels profile={productProfile} />
              <Button
                fullWidth
                size="small"
                variant="contained"
                color={side === 'SELL' ? 'error' : 'success'}
                disabled={Boolean(busyProduct)}
                onClick={() => handleTrade(opt.value)}
                sx={{ mt: 1, textTransform: 'none', fontWeight: 800 }}
              >
                {busy ? <CircularProgress size={16} color="inherit" /> : `${side} ${opt.label}`}
              </Button>
            </Box>
          );
        })}
      </Box>

      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
        Broker: {String(broker || 'dhan').toUpperCase()} · Market order with alert setup levels
      </Typography>

      {message ? <Alert severity="success" sx={{ mt: 1 }}>{message}</Alert> : null}
      {error ? (
        <Alert
          severity="error"
          sx={{ mt: 1 }}
          action={(
            <Button
              color="inherit"
              size="small"
              onClick={() => navigate('/profile', { state: { openBrokerSetup: true, preferredBroker: broker } })}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              Broker setup
            </Button>
          )}
        >
          {error}
        </Alert>
      ) : null}
    </Box>
  );
}

export default AlertTradeActions;
