import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { fetchOrders, fetchPortfolioPositions } from '../api/orders';
import { useAuth } from '../auth/AuthContext';

const resolveUserId = (user) => user?.id || user?.user_id || user?.email || '';

const toInr = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const nextMoveColor = {
  Hold: 'default',
  TrailSL: 'primary',
  BookPartial: 'secondary',
  ExitSL: 'error',
  ExitTarget: 'success',
};

function PortfolioManagerPage() {
  const { user } = useAuth();
  const userId = resolveUserId(user);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [positions, setPositions] = useState([]);
  const [orders, setOrders] = useState([]);

  const load = useCallback(async () => {
    if (!userId) {
      setPositions([]);
      setOrders([]);
      setBusy(false);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const [posRows, orderRows] = await Promise.all([
        fetchPortfolioPositions({ userId }),
        fetchOrders({ userId }),
      ]);
      setPositions(Array.isArray(posRows) ? posRows : []);
      setOrders(Array.isArray(orderRows) ? orderRows : []);
    } catch (e) {
      setError(e?.message || 'Failed to load portfolio manager data');
    } finally {
      setBusy(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [load]);

  const { openPositions, closedPositions } = useMemo(() => {
    const open = [];
    const closed = [];
    for (const row of positions) {
      if (String(row?.state || '').toUpperCase() === 'CLOSED' || Number(row?.net_qty || 0) === 0) {
        closed.push(row);
      } else {
        open.push(row);
      }
    }
    return { openPositions: open, closedPositions: closed };
  }, [positions]);

  const netSummary = useMemo(() => {
    return positions.reduce(
      (acc, row) => {
        acc.realized += Number(row?.realized_pnl || 0);
        acc.unrealized += Number(row?.unrealized_pnl || 0);
        return acc;
      },
      { realized: 0, unrealized: 0 }
    );
  }, [positions]);

  const timelineRows = useMemo(
    () =>
      [...orders]
        .sort((a, b) => new Date(b?.updated_at || b?.created_at || 0).getTime() - new Date(a?.updated_at || a?.created_at || 0).getTime())
        .slice(0, 50),
    [orders]
  );

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Portfolio Manager
        </Typography>
        <Button variant="outlined" onClick={load} disabled={busy} sx={{ textTransform: 'none' }}>
          Refresh
        </Button>
      </Stack>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2} sx={{ mb: 2 }}>
        <Chip label={`Open Positions: ${openPositions.length}`} color="primary" variant="outlined" />
        <Chip label={`Closed Positions: ${closedPositions.length}`} color="default" variant="outlined" />
        <Chip label={`Realized PnL: ${toInr(netSummary.realized)}`} color={netSummary.realized >= 0 ? 'success' : 'error'} />
        <Chip label={`Unrealized PnL: ${toInr(netSummary.unrealized)}`} color={netSummary.unrealized >= 0 ? 'success' : 'error'} />
        <Chip label={`Net PnL: ${toInr(netSummary.realized + netSummary.unrealized)}`} color={netSummary.realized + netSummary.unrealized >= 0 ? 'success' : 'error'} />
      </Stack>

      {busy ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" sx={{ mb: 1.2 }}>Open Positions</Typography>
            {!openPositions.length ? (
              <Typography sx={{ color: '#666', fontSize: 13 }}>No open positions.</Typography>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Symbol</TableCell>
                      <TableCell>Broker</TableCell>
                      <TableCell>Product</TableCell>
                      <TableCell align="right">Qty</TableCell>
                      <TableCell align="right">Avg Price</TableCell>
                      <TableCell align="right">LTP</TableCell>
                      <TableCell align="right">Unrealized PnL</TableCell>
                      <TableCell>Next Move</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {openPositions.map((row) => (
                      <TableRow key={`${row.id}-${row.symbol}`}>
                        <TableCell sx={{ fontWeight: 700 }}>{row.symbol}</TableCell>
                        <TableCell>{String(row.broker || '').toUpperCase()}</TableCell>
                        <TableCell>{row.product_type}</TableCell>
                        <TableCell align="right">{row.net_qty}</TableCell>
                        <TableCell align="right">{toInr(row.avg_price)}</TableCell>
                        <TableCell align="right">{toInr(row.ltp)}</TableCell>
                        <TableCell align="right" sx={{ color: Number(row.unrealized_pnl || 0) >= 0 ? '#1b5e20' : '#c62828', fontWeight: 700 }}>
                          {toInr(row.unrealized_pnl)}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={row.next_move || 'Hold'}
                            color={nextMoveColor[row.next_move] || 'default'}
                            sx={{ fontWeight: 700 }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>

          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" sx={{ mb: 1.2 }}>Closed Trades</Typography>
            {!closedPositions.length ? (
              <Typography sx={{ color: '#666', fontSize: 13 }}>No closed trades yet.</Typography>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Symbol</TableCell>
                      <TableCell>Broker</TableCell>
                      <TableCell>Product</TableCell>
                      <TableCell align="right">Realized PnL</TableCell>
                      <TableCell>State</TableCell>
                      <TableCell>Next Move</TableCell>
                      <TableCell>Updated</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {closedPositions.map((row) => (
                      <TableRow key={`${row.id}-${row.symbol}`}>
                        <TableCell sx={{ fontWeight: 700 }}>{row.symbol}</TableCell>
                        <TableCell>{String(row.broker || '').toUpperCase()}</TableCell>
                        <TableCell>{row.product_type}</TableCell>
                        <TableCell align="right" sx={{ color: Number(row.realized_pnl || 0) >= 0 ? '#1b5e20' : '#c62828', fontWeight: 700 }}>
                          {toInr(row.realized_pnl)}
                        </TableCell>
                        <TableCell>{row.state}</TableCell>
                        <TableCell>
                          <Chip size="small" label={row.next_move || 'ExitTarget'} color={nextMoveColor[row.next_move] || 'default'} />
                        </TableCell>
                        <TableCell>{row.updated_at ? new Date(row.updated_at).toLocaleString() : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 1.2 }}>Order Timeline + Charge Breakup</Typography>
            {!timelineRows.length ? (
              <Typography sx={{ color: '#666', fontSize: 13 }}>No orders available.</Typography>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Time</TableCell>
                      <TableCell>Symbol</TableCell>
                      <TableCell>Side</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Broker Order ID</TableCell>
                      <TableCell align="right">Qty</TableCell>
                      <TableCell align="right">Price</TableCell>
                      <TableCell align="right">Charges</TableCell>
                      <TableCell align="right">STT</TableCell>
                      <TableCell align="right">GST</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {timelineRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.updated_at ? new Date(row.updated_at).toLocaleString() : new Date(row.created_at).toLocaleString()}</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>{row.symbol}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={row.side}
                            color={row.side === 'BUY' ? 'success' : 'error'}
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>{row.status}</TableCell>
                        <TableCell>{row.broker_order_id || '—'}</TableCell>
                        <TableCell align="right">{row.qty}</TableCell>
                        <TableCell align="right">{toInr(row.price)}</TableCell>
                        <TableCell align="right">{toInr(row?.charge_breakup?.total_charges)}</TableCell>
                        <TableCell align="right">{toInr(row?.charge_breakup?.stt)}</TableCell>
                        <TableCell align="right">{toInr(row?.charge_breakup?.gst)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </>
      )}
    </Box>
  );
}

export default PortfolioManagerPage;
