import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Link,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { fetchBrokerSetup, saveBrokerSetup, validateBrokerSetup } from '../api/brokers';
import {
  fetchDhanHoldings,
  connectDhan,
  fetchDhanOrders,
  fetchDhanPositions,
} from '../api/dhan';

const pickArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.positions)) return payload.positions;
  if (Array.isArray(payload?.orders)) return payload.orders;
  if (Array.isArray(payload?.result)) return payload.result;
  return [];
};

const deriveOpenPositionsFromOrders = (orders) => {
  const rows = Array.isArray(orders) ? orders : [];
  const bySymbol = new Map();
  rows.forEach((row) => {
    const status = String(row?.orderStatus || row?.status || '').toUpperCase();
    if (!['FILLED', 'PARTIAL', 'COMPLETE'].includes(status)) return;
    const symbol = String(row?.tradingSymbol || row?.symbol || row?.securityId || '').trim().toUpperCase();
    if (!symbol) return;
    const side = String(row?.transactionType || row?.side || '').toUpperCase();
    const qty = Number(row?.filledQty ?? row?.quantity ?? row?.qty ?? 0);
    if (!Number.isFinite(qty) || qty <= 0) return;
    const price = Number(row?.averagePrice ?? row?.avgPrice ?? row?.price ?? 0);
    const current = bySymbol.get(symbol) || { tradingSymbol: symbol, netQty: 0, buyValue: 0 };
    if (side === 'BUY') {
      current.netQty += qty;
      if (Number.isFinite(price) && price > 0) current.buyValue += qty * price;
    } else if (side === 'SELL') {
      current.netQty -= qty;
      if (Number.isFinite(price) && price > 0) current.buyValue -= qty * price;
    }
    bySymbol.set(symbol, current);
  });
  return [...bySymbol.values()]
    .filter((r) => Number(r.netQty) !== 0)
    .map((r) => ({
      ...r,
      productType: 'DELIVERY',
      buyAvg: r.netQty !== 0 ? Math.abs((r.buyValue || 0) / r.netQty) : 0,
      pnl: 0,
      ltp: 0,
    }));
};

function ProfilePage() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const userId = String(user?.id || user?.user_id || user?.email || '');
  const brokerSessionKey = (broker) => `broker_session_auth_${userId}_${String(broker || '').toLowerCase()}`;
  const onboardingBrokerSetup = Boolean(location.state?.openBrokerSetup);
  const onboardingTargetPath = location.state?.from || '/';
  const [activeTab, setActiveTab] = useState('account');
  const [rows, setRows] = useState([]);
  const [selectedBroker, setSelectedBroker] = useState('dhan');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [positions, setPositions] = useState([]);
  const [orders, setOrders] = useState([]);
  const isLiveExecution = (row) => Boolean(row?.is_enabled && row?.has_session) || Boolean(row?.live_enabled);

  const connectedDhan = rows.find((r) => r.broker === 'dhan')?.is_enabled;
  const liveEnabledCount = rows.filter((r) => isLiveExecution(r)).length;
  const displayName = user?.name || user?.full_name || '—';
  const displayEmail = user?.email || '—';
  const displayMobile = user?.mobile || user?.phone || '—';

  const emptyCredentials = (broker) => {
    if (broker === 'dhan') return { pin: '', totp: '', access_token: '' };
    if (broker === 'angelone') return { api_key: '', pin: '', totp: '', access_token: '' };
    if (broker === 'upstox') return { access_token: '', auth_code: '', client_secret: '', redirect_uri: '' };
    return { pin: '', access_token: '' }; // samco
  };

  const loadBrokerRows = useCallback(async () => {
    try {
      const data = await fetchBrokerSetup({ userId });
      setRows(
        (Array.isArray(data) ? data : []).map((row) => ({
          ...row,
          credentials: emptyCredentials(row.broker),
        }))
      );
    } catch (_) {
      setRows([]);
    }
  }, [userId]);

  const loadLiveData = async () => {
    setError('');
    try {
      const [posResult, holdResult, ordResult] = await Promise.allSettled([
        fetchDhanPositions({ userId }),
        fetchDhanHoldings({ userId }),
        fetchDhanOrders({ userId }),
      ]);
      const parsedPositions = posResult.status === 'fulfilled' ? pickArray(posResult.value) : [];
      const parsedHoldings = holdResult.status === 'fulfilled' ? pickArray(holdResult.value) : [];
      const parsedOrders = ordResult.status === 'fulfilled' ? pickArray(ordResult.value) : [];
      const mergedPositionsRaw = [...parsedPositions, ...parsedHoldings];
      const mergedPositions = mergedPositionsRaw.length ? mergedPositionsRaw : deriveOpenPositionsFromOrders(parsedOrders);
      setPositions(mergedPositions);
      setOrders(parsedOrders);
      try {
        localStorage.setItem(`dhan_live_positions_${userId}`, JSON.stringify(mergedPositions));
        localStorage.setItem(`dhan_live_orders_${userId}`, JSON.stringify(parsedOrders));
        localStorage.setItem(`dhan_live_sync_${userId}`, String(Date.now()));
      } catch (_) {
        // ignore localStorage failures
      }
      if (!mergedPositions.length && !parsedOrders.length) {
        setMessage('Session active. No open positions/holdings found for this account.');
      } else if (!mergedPositionsRaw.length && mergedPositions.length) {
        setMessage(`Session active. Positions reconstructed from ${parsedOrders.length} Dhan orders.`);
      }
    } catch (e) {
      setError(e?.message || 'Failed to fetch Dhan live data');
    }
  };

  useEffect(() => {
    loadBrokerRows();
  }, [loadBrokerRows]);

  useEffect(() => {
    if (!onboardingBrokerSetup) return;
    setActiveTab('broker');
    setMessage('Complete broker validation to activate session and show holdings on dashboard.');
  }, [onboardingBrokerSetup]);

  const updateRow = (broker, patch) => {
    setRows((prev) => {
      const index = prev.findIndex((r) => r.broker === broker);
      if (index >= 0) {
        return prev.map((r) => (r.broker === broker ? { ...r, ...patch } : r));
      }
      return [
        ...prev,
        {
          broker,
          client_id: '',
          is_enabled: true,
          has_session: false,
          live_enabled: false,
          credentials: emptyCredentials(broker),
          ...patch,
        },
      ];
    });
  };

  const updateRowCredential = (broker, key, value) => {
    setRows((prev) => {
      const index = prev.findIndex((r) => r.broker === broker);
      if (index >= 0) {
        return prev.map((r) => (
          r.broker === broker
            ? { ...r, credentials: { ...(r.credentials || {}), [key]: value } }
            : r
        ));
      }
      return [
        ...prev,
        {
          broker,
          client_id: '',
          is_enabled: true,
          has_session: false,
          live_enabled: false,
          credentials: { ...emptyCredentials(broker), [key]: value },
        },
      ];
    });
  };

  const onSaveBroker = async (row) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const payload = {
        user_id: userId,
        broker: row.broker,
        client_id: (row.client_id || ''),
        is_enabled: Boolean(row?.is_enabled),
        has_session: Boolean(row?.has_session),
      };
      await saveBrokerSetup(payload);
      setMessage(`${row.broker.toUpperCase()} setup saved.`);
      await loadBrokerRows();
    } catch (e) {
      setError(e?.message || 'Failed to save broker setup');
    } finally {
      setBusy(false);
    }
  };

  const onValidateBroker = async (row) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const rawClientId = row.client_id || '';
      const sanitizedDhanClientId = row.broker === 'dhan'
        ? String(rawClientId).replace(/\s/g, '').replace(/^\+/, '')
        : String(rawClientId);
      const payload = {
        user_id: userId,
        broker: row.broker,
        client_id: sanitizedDhanClientId,
        pin: (row.credentials?.pin || '').trim(),
        totp: (row.credentials?.totp || '').replace(/\s/g, '').trim(),
        api_key: (row.credentials?.api_key || '').trim(),
        client_secret: (row.credentials?.client_secret || '').trim(),
        redirect_uri: (row.credentials?.redirect_uri || '').trim(),
        auth_code: (row.credentials?.auth_code || '').trim(),
        access_token: (row.credentials?.access_token || '').trim(),
      };
      if (!Boolean(row?.is_enabled)) {
        await onSaveBroker({ ...row, is_enabled: false });
        setMessage(`${row.broker.toUpperCase()} saved for later. Enable integration when ready.`);
        return;
      }
      let res = null;
      let validated = false;
      let effectiveToken = payload.access_token;
      if (row.broker === 'dhan') {
        const connectRes = await connectDhan({
          user_id: userId,
          client_id: payload.client_id,
          pin: payload.pin,
          totp: payload.totp,
          access_token: payload.access_token,
        });
        effectiveToken = String(connectRes?.session_token || effectiveToken || '').trim();
        if (!effectiveToken) {
          throw new Error('Unable to create Dhan session token. Check Client ID/PIN/TOTP or JWT token.');
        }
        payload.access_token = effectiveToken;
      }
      res = await validateBrokerSetup(payload);
      validated = Boolean(res?.validated);
      if (row.broker === 'dhan' && effectiveToken) {
        updateRowCredential(row.broker, 'access_token', effectiveToken);
      }

      if (validated) {
        setMessage(`${row.broker.toUpperCase()} validation successful.`);
        if (row.broker === 'dhan') {
          setRows((prev) => prev.map((r) => (
            r.broker === row.broker
              ? { ...r, has_session: true, is_enabled: true, last_auth_at: new Date().toISOString() }
              : r
          )));
        }
        try {
          localStorage.setItem(brokerSessionKey(row.broker), String(Date.now()));
        } catch (_) {
          // ignore localStorage failures
        }
      } else {
        setError(res?.reason || `${row.broker.toUpperCase()} setup saved. Complete required credentials to activate session.`);
        if (row.broker === 'dhan') {
          setRows((prev) => prev.map((r) => (
            r.broker === row.broker
              ? { ...r, has_session: false }
              : r
          )));
          try {
            localStorage.removeItem(brokerSessionKey(row.broker));
          } catch (_) {
            // ignore localStorage failures
          }
        }
      }

      await loadBrokerRows();
      if (validated && row.broker === 'dhan') {
        await loadLiveData();
      }
      if (validated && onboardingBrokerSetup) {
        navigate(onboardingTargetPath, { replace: true, state: { brokerSetupCompleted: true } });
      }
    } catch (e) {
      setError(e?.message || `Validation failed for ${row.broker}`);
    } finally {
      setBusy(false);
    }
  };

  const onRenewBrokerToken = async (row) => {
    if (!row || row.broker !== 'dhan') return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await connectDhan({
        user_id: userId,
        client_id: String(row.client_id || '').trim(),
        access_token: String(row.credentials?.access_token || '').trim(),
        renew_token: true,
      });
      const renewedToken = String(res?.session_token || '').trim();
      if (renewedToken) {
        updateRowCredential(row.broker, 'access_token', renewedToken);
      }
      setMessage('Dhan access token renewed successfully.');
      await loadBrokerRows();
      await loadLiveData();
    } catch (e) {
      setError(e?.message || 'Failed to renew Dhan token');
    } finally {
      setBusy(false);
    }
  };

  const positionColumns = useMemo(() => {
    if (!positions.length) return [];
    const preferred = ['securityId', 'tradingSymbol', 'productType', 'netQty', 'buyAvg', 'sellAvg', 'ltp', 'pnl'];
    const presentPreferred = preferred.filter((k) => Object.prototype.hasOwnProperty.call(positions[0], k));
    if (presentPreferred.length) return presentPreferred;
    return Object.keys(positions[0]).slice(0, 8);
  }, [positions]);

  const orderColumns = useMemo(() => {
    if (!orders.length) return [];
    const preferred = ['orderId', 'tradingSymbol', 'transactionType', 'orderType', 'quantity', 'price', 'orderStatus'];
    const presentPreferred = preferred.filter((k) => Object.prototype.hasOwnProperty.call(orders[0], k));
    if (presentPreferred.length) return presentPreferred;
    return Object.keys(orders[0]).slice(0, 8);
  }, [orders]);

  const brokerRows = useMemo(() => {
    const fallback = ['dhan', 'samco', 'angelone', 'upstox'].map((broker) => ({
      broker,
      client_id: '',
      is_enabled: false,
      has_session: false,
      live_enabled: false,
      credentials: emptyCredentials(broker),
    }));
    if (!rows.length) return fallback;
    const byBroker = new Map(rows.map((r) => [r.broker, r]));
    return ['dhan', 'samco', 'angelone', 'upstox'].map((broker) => {
      const row = byBroker.get(broker);
      return row
        ? { ...row, credentials: row.credentials || emptyCredentials(broker) }
        : {
            broker,
            client_id: '',
            is_enabled: false,
            has_session: false,
            live_enabled: false,
            credentials: emptyCredentials(broker),
          };
    });
  }, [rows]);

  const activeBrokerRow = useMemo(
    () => brokerRows.find((r) => r.broker === selectedBroker) || brokerRows[0] || null,
    [brokerRows, selectedBroker]
  );

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 700 }}>
        Profile
      </Typography>
      <Tabs
        value={activeTab}
        onChange={(_, value) => setActiveTab(value)}
        sx={{ mb: 2, borderBottom: '1px solid #e0e0e0' }}
      >
        <Tab value="account" label="Account Details" />
        <Tab value="broker" label="Broker Integration" />
      </Tabs>

      {activeTab === 'account' ? (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" sx={{ mb: 1.5 }}>User Profile</Typography>
          <Box sx={{ display: 'grid', gap: 1.2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' } }}>
            <TextField size="small" label="Name" value={displayName} disabled />
            <TextField size="small" label="Email ID" value={displayEmail} disabled />
            <TextField size="small" label="Mobile Number" value={displayMobile} disabled />
            <TextField size="small" label="Password" value="********" type="password" disabled />
          </Box>
          <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
            <Button
              variant="contained"
              sx={{ textTransform: 'none' }}
              onClick={() => navigate('/forgot-password')}
            >
              Change Password
            </Button>
            <Typography sx={{ fontSize: 12, color: '#666', alignSelf: 'center' }}>
              Password is never shown directly for security.
            </Typography>
          </Stack>
        </Paper>
      ) : null}

      {activeTab === 'broker' ? (
        <>
      {isAdmin ? (
        <Alert severity={liveEnabledCount > 0 ? 'success' : 'info'} sx={{ mb: 2 }}>
          Live execution: {liveEnabledCount > 0 ? `${liveEnabledCount} broker session(s) active.` : 'Activate broker session to place live orders.'}
        </Alert>
      ) : null}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography sx={{ fontSize: 13, color: '#555', mb: 1.5 }}>
          Select your broker, enter only the required fields for that broker, validate, and keep integration enabled now or later.
        </Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2} sx={{ mb: 1.5 }}>
          <TextField
            select
            size="small"
            label="Select Broker"
            value={selectedBroker}
            onChange={(e) => setSelectedBroker(e.target.value)}
            sx={{ minWidth: 220 }}
          >
            {brokerRows.map((row) => (
              <MenuItem key={row.broker} value={row.broker}>{row.broker.toUpperCase()}</MenuItem>
            ))}
          </TextField>
          <Button variant="outlined" onClick={loadBrokerRows} disabled={busy} sx={{ textTransform: 'none' }}>
            Refresh Broker Setup
          </Button>
        </Stack>

        {activeBrokerRow ? (
          <>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2} sx={{ mb: 1.2 }}>
              <TextField
                size="small"
                label="Client ID"
                value={activeBrokerRow.client_id || ''}
                onChange={(e) => updateRow(activeBrokerRow.broker, { client_id: e.target.value })}
                sx={{ minWidth: 260 }}
              />
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography sx={{ fontSize: 12, color: '#666' }}>Enable now</Typography>
                <Switch
                  checked={Boolean(activeBrokerRow.is_enabled)}
                  onChange={(e) => updateRow(activeBrokerRow.broker, { is_enabled: e.target.checked })}
                />
                <Typography sx={{ fontSize: 12, color: activeBrokerRow.is_enabled ? '#1b5e20' : '#666', fontWeight: 600 }}>
                  {activeBrokerRow.is_enabled ? 'Enabled' : 'Enable later'}
                </Typography>
              </Stack>
            </Stack>

            <Box sx={{ display: 'grid', gap: 1.1, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, mb: 1.2 }}>
              {activeBrokerRow.broker === 'dhan' ? (
                <>
                  <TextField size="small" type="password" label="PIN" value={activeBrokerRow.credentials?.pin || ''} onChange={(e) => updateRowCredential(activeBrokerRow.broker, 'pin', e.target.value)} />
                  <TextField size="small" label="TOTP" value={activeBrokerRow.credentials?.totp || ''} onChange={(e) => updateRowCredential(activeBrokerRow.broker, 'totp', e.target.value)} />
                  <TextField
                    size="small"
                    label="Access Token (JWT optional)"
                    value={activeBrokerRow.credentials?.access_token || ''}
                    onChange={(e) => updateRowCredential(activeBrokerRow.broker, 'access_token', e.target.value)}
                    placeholder="Use Dhan JWT token if available"
                  />
                </>
              ) : null}
              {activeBrokerRow.broker === 'samco' ? (
                <>
                  <TextField size="small" type="password" label="PIN/Password" value={activeBrokerRow.credentials?.pin || ''} onChange={(e) => updateRowCredential(activeBrokerRow.broker, 'pin', e.target.value)} />
                  <TextField size="small" label="Access Token (optional)" value={activeBrokerRow.credentials?.access_token || ''} onChange={(e) => updateRowCredential(activeBrokerRow.broker, 'access_token', e.target.value)} />
                </>
              ) : null}
              {activeBrokerRow.broker === 'angelone' ? (
                <>
                  <TextField size="small" label="Access Token (optional)" value={activeBrokerRow.credentials?.access_token || ''} onChange={(e) => updateRowCredential(activeBrokerRow.broker, 'access_token', e.target.value)} />
                  <TextField size="small" label="API Key" value={activeBrokerRow.credentials?.api_key || ''} onChange={(e) => updateRowCredential(activeBrokerRow.broker, 'api_key', e.target.value)} />
                  <TextField size="small" type="password" label="PIN/Password" value={activeBrokerRow.credentials?.pin || ''} onChange={(e) => updateRowCredential(activeBrokerRow.broker, 'pin', e.target.value)} />
                  <TextField size="small" label="TOTP" value={activeBrokerRow.credentials?.totp || ''} onChange={(e) => updateRowCredential(activeBrokerRow.broker, 'totp', e.target.value)} />
                </>
              ) : null}
              {activeBrokerRow.broker === 'upstox' ? (
                <>
                  <TextField size="small" label="Access Token (optional)" value={activeBrokerRow.credentials?.access_token || ''} onChange={(e) => updateRowCredential(activeBrokerRow.broker, 'access_token', e.target.value)} />
                  <TextField size="small" label="Auth Code" value={activeBrokerRow.credentials?.auth_code || ''} onChange={(e) => updateRowCredential(activeBrokerRow.broker, 'auth_code', e.target.value)} />
                  <TextField size="small" label="Client Secret" value={activeBrokerRow.credentials?.client_secret || ''} onChange={(e) => updateRowCredential(activeBrokerRow.broker, 'client_secret', e.target.value)} />
                  <TextField size="small" label="Redirect URI" value={activeBrokerRow.credentials?.redirect_uri || ''} onChange={(e) => updateRowCredential(activeBrokerRow.broker, 'redirect_uri', e.target.value)} />
                </>
              ) : null}
            </Box>

            <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
              <Button size="small" variant="outlined" onClick={() => onSaveBroker(activeBrokerRow)} disabled={busy} sx={{ textTransform: 'none' }}>
                Save
              </Button>
              <Button size="small" variant="contained" onClick={() => onValidateBroker(activeBrokerRow)} disabled={busy} sx={{ textTransform: 'none' }}>
                Validate & Create Session
              </Button>
              {activeBrokerRow.broker === 'dhan' ? (
                <Button size="small" variant="outlined" onClick={() => onRenewBrokerToken(activeBrokerRow)} disabled={busy} sx={{ textTransform: 'none' }}>
                  Renew Token
                </Button>
              ) : null}
              {activeBrokerRow.doc_url ? (
                <Button size="small" component={Link} href={activeBrokerRow.doc_url} target="_blank" rel="noreferrer" sx={{ textTransform: 'none' }}>
                  Open docs
                </Button>
              ) : null}
            </Stack>

            <Stack direction="row" spacing={0.8} alignItems="center" flexWrap="wrap">
              <Chip size="small" label={activeBrokerRow.has_session ? 'Session active' : 'No session'} color={activeBrokerRow.has_session ? 'success' : 'default'} variant={activeBrokerRow.has_session ? 'filled' : 'outlined'} />
              {isAdmin ? (
                <Chip size="small" label={isLiveExecution(activeBrokerRow) ? 'LIVE enabled' : 'Session required'} color={isLiveExecution(activeBrokerRow) ? 'error' : 'primary'} variant={isLiveExecution(activeBrokerRow) ? 'filled' : 'outlined'} />
              ) : null}
              <Typography sx={{ fontSize: 12, color: '#666', ml: 0.5 }}>
                {activeBrokerRow.last_auth_at ? `Last auth: ${new Date(activeBrokerRow.last_auth_at).toLocaleString()}` : 'Validate to create broker session.'}
              </Typography>
            </Stack>
          </>
        ) : null}
      </Paper>

      {message ? <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert> : null}
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>Live Positions</Typography>
        {!positions.length ? (
          <Typography sx={{ fontSize: 13, color: '#666' }}>
            {connectedDhan ? 'No open positions found.' : 'Validate Dhan setup to load positions.'}
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {positionColumns.map((c) => <TableCell key={c}>{c}</TableCell>)}
                </TableRow>
              </TableHead>
              <TableBody>
                {positions.map((row, idx) => (
                  <TableRow key={`pos-${idx}`}>
                    {positionColumns.map((c) => (
                      <TableCell key={`${idx}-${c}`}>{String(row?.[c] ?? '—')}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>Recent Orders</Typography>
        {!orders.length ? (
          <Typography sx={{ fontSize: 13, color: '#666' }}>
            {connectedDhan ? 'No orders found.' : 'Validate Dhan setup to load orders.'}
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {orderColumns.map((c) => <TableCell key={c}>{c}</TableCell>)}
                </TableRow>
              </TableHead>
              <TableBody>
                {orders.map((row, idx) => (
                  <TableRow key={`ord-${idx}`}>
                    {orderColumns.map((c) => (
                      <TableCell key={`${idx}-${c}`}>{String(row?.[c] ?? '—')}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
        </>
      ) : null}
    </Box>
  );
}

export default ProfilePage;
