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
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { fetchBrokerSetup, saveBrokerSetup, validateBrokerSetup } from '../api/brokers';
import {
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

function ProfilePage() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('account');
  const [rows, setRows] = useState([]);
  const [selectedBroker, setSelectedBroker] = useState('dhan');
  const [integrationEnabled, setIntegrationEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [positions, setPositions] = useState([]);
  const [orders, setOrders] = useState([]);

  const adminDhanClientId = '1106536389';
  const connectedDhan = rows.find((r) => r.broker === 'dhan')?.is_enabled;
  const liveEnabledCount = rows.filter((r) => Boolean(r.live_enabled)).length;
  const displayName = user?.name || user?.full_name || '—';
  const displayEmail = user?.email || '—';
  const displayMobile = user?.mobile || user?.phone || '—';

  const emptyCredentials = (broker) => {
    if (broker === 'dhan') return { pin: '', totp: '' };
    if (broker === 'angelone') return { api_key: '', pin: '', totp: '' };
    if (broker === 'upstox') return { access_token: '', auth_code: '', client_secret: '', redirect_uri: '' };
    return { pin: '' }; // samco
  };

  const loadBrokerRows = useCallback(async () => {
    try {
      const data = await fetchBrokerSetup();
      setRows(
        (Array.isArray(data) ? data : []).map((row) => ({
          ...row,
          credentials: emptyCredentials(row.broker),
        }))
      );
    } catch (_) {
      setRows([]);
    }
  }, []);

  const loadLiveData = async () => {
    setError('');
    try {
      const [pos, ord] = await Promise.all([fetchDhanPositions(), fetchDhanOrders()]);
      setPositions(pickArray(pos));
      setOrders(pickArray(ord));
    } catch (e) {
      setError(e?.message || 'Failed to fetch Dhan live data');
    }
  };

  useEffect(() => {
    loadBrokerRows();
  }, [loadBrokerRows]);

  useEffect(() => {
    const row = rows.find((r) => r.broker === selectedBroker);
    if (row) setIntegrationEnabled(Boolean(row.is_enabled));
  }, [rows, selectedBroker]);

  const updateRow = (broker, patch) => {
    setRows((prev) =>
      prev.map((r) => (r.broker === broker ? { ...r, ...patch } : r))
    );
  };

  const updateRowCredential = (broker, key, value) => {
    setRows((prev) =>
      prev.map((r) => (
        r.broker === broker
          ? { ...r, credentials: { ...(r.credentials || {}), [key]: value } }
          : r
      ))
    );
  };

  const onSaveBroker = async (row) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const payload = {
        broker: row.broker,
        client_id:
          row.broker === 'dhan' && isAdmin
            ? (row.client_id || adminDhanClientId)
            : (row.client_id || ''),
        is_enabled: Boolean(integrationEnabled),
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
      const payload = {
        broker: row.broker,
        client_id:
          row.broker === 'dhan' && isAdmin
            ? (row.client_id || adminDhanClientId)
            : (row.client_id || ''),
        pin: (row.credentials?.pin || '').trim(),
        totp: (row.credentials?.totp || '').trim(),
        api_key: (row.credentials?.api_key || '').trim(),
        client_secret: (row.credentials?.client_secret || '').trim(),
        redirect_uri: (row.credentials?.redirect_uri || '').trim(),
        auth_code: (row.credentials?.auth_code || '').trim(),
        access_token: (row.credentials?.access_token || '').trim(),
      };
      if (!integrationEnabled) {
        await onSaveBroker({ ...row, is_enabled: false });
        setMessage(`${row.broker.toUpperCase()} saved for later. Enable integration when ready.`);
        return;
      }
      const res = await validateBrokerSetup(payload);
      setMessage(
        res?.validated
          ? `${row.broker.toUpperCase()} validation successful.`
          : `${row.broker.toUpperCase()} setup checked and saved.`
      );
      await loadBrokerRows();
      if (row.broker === 'dhan') {
        await loadLiveData();
      }
    } catch (e) {
      setError(e?.message || `Validation failed for ${row.broker}`);
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
      client_id: broker === 'dhan' && isAdmin ? adminDhanClientId : '',
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
            client_id: broker === 'dhan' && isAdmin ? adminDhanClientId : '',
            is_enabled: false,
            has_session: false,
            live_enabled: false,
            credentials: emptyCredentials(broker),
          };
    });
  }, [rows, isAdmin]);

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
        <Alert severity={liveEnabledCount > 0 ? 'warning' : 'info'} sx={{ mb: 2 }}>
          Execution mode: {liveEnabledCount > 0 ? `${liveEnabledCount} broker(s) in LIVE mode.` : 'All brokers are in PAPER mode.'}
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
                value={activeBrokerRow.broker === 'dhan' && isAdmin ? (activeBrokerRow.client_id || adminDhanClientId) : (activeBrokerRow.client_id || '')}
                disabled={activeBrokerRow.broker === 'dhan' && isAdmin}
                onChange={(e) => updateRow(activeBrokerRow.broker, { client_id: e.target.value })}
                sx={{ minWidth: 260 }}
              />
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography sx={{ fontSize: 12, color: '#666' }}>Enable now</Typography>
                <Switch checked={integrationEnabled} onChange={(e) => setIntegrationEnabled(e.target.checked)} />
                <Typography sx={{ fontSize: 12, color: integrationEnabled ? '#1b5e20' : '#666', fontWeight: 600 }}>
                  {integrationEnabled ? 'Enabled' : 'Enable later'}
                </Typography>
              </Stack>
            </Stack>

            <Box sx={{ display: 'grid', gap: 1.1, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, mb: 1.2 }}>
              {activeBrokerRow.broker === 'dhan' ? (
                <>
                  <TextField size="small" type="password" label="PIN" value={activeBrokerRow.credentials?.pin || ''} onChange={(e) => updateRowCredential(activeBrokerRow.broker, 'pin', e.target.value)} />
                  <TextField size="small" label="TOTP" value={activeBrokerRow.credentials?.totp || ''} onChange={(e) => updateRowCredential(activeBrokerRow.broker, 'totp', e.target.value)} />
                </>
              ) : null}
              {activeBrokerRow.broker === 'samco' ? (
                <TextField size="small" type="password" label="PIN/Password" value={activeBrokerRow.credentials?.pin || ''} onChange={(e) => updateRowCredential(activeBrokerRow.broker, 'pin', e.target.value)} />
              ) : null}
              {activeBrokerRow.broker === 'angelone' ? (
                <>
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
              {activeBrokerRow.doc_url ? (
                <Button size="small" component={Link} href={activeBrokerRow.doc_url} target="_blank" rel="noreferrer" sx={{ textTransform: 'none' }}>
                  Open docs
                </Button>
              ) : null}
            </Stack>

            <Stack direction="row" spacing={0.8} alignItems="center" flexWrap="wrap">
              <Chip size="small" label={activeBrokerRow.has_session ? 'Session active' : 'No session'} color={activeBrokerRow.has_session ? 'success' : 'default'} variant={activeBrokerRow.has_session ? 'filled' : 'outlined'} />
              {isAdmin ? (
                <Chip size="small" label={activeBrokerRow.live_enabled ? 'LIVE enabled' : 'PAPER mode'} color={activeBrokerRow.live_enabled ? 'error' : 'primary'} variant={activeBrokerRow.live_enabled ? 'filled' : 'outlined'} />
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
