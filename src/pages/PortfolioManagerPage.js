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
  Tooltip,
  Typography,
} from '@mui/material';
import { fetchOrders, fetchPortfolioPositions } from '../api/orders';
import { fetchDhanHoldings, fetchDhanOrders, fetchDhanPositions } from '../api/dhan';
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
const orderStatusColor = {
  PLACED: 'primary',
  FILLED: 'success',
  REJECTED: 'error',
  CANCELLED: 'default',
};

const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
const isLiveExecution = (row) => String(row?.execution_mode || 'live').toLowerCase() === 'live';

const mapDhanRowToPortfolioPosition = (row, source = 'position') => {
  const symbol = String(
    row?.tradingSymbol
    || row?.symbol
    || row?.securityId
    || row?.scripName
    || ''
  ).trim().toUpperCase();
  const qty = num(
    row?.netQty
    ?? row?.net_qty
    ?? row?.totalQty
    ?? row?.availableQty
    ?? row?.quantity
    ?? row?.qty
  );
  const avgPrice = num(row?.buyAvg ?? row?.averagePrice ?? row?.avgPrice ?? row?.avgCostPrice);
  const ltp = num(row?.ltp ?? row?.lastTradedPrice ?? row?.lastPrice ?? row?.close);
  const realized = source === 'holding'
    ? 0
    : num(row?.realizedProfit ?? row?.realizedPnl ?? row?.realized_pnl);
  const unrealizedRaw = num(row?.unrealizedProfit ?? row?.unrealizedPnl ?? row?.unrealized_pnl ?? row?.pnl);
  const unrealized = unrealizedRaw !== 0
    ? unrealizedRaw
    : ((qty > 0 && avgPrice > 0 && ltp > 0) ? ((ltp - avgPrice) * qty) : 0);
  const state = source === 'holding'
    ? (qty > 0 ? 'OPEN' : 'CLOSED')
    : (qty === 0 ? 'CLOSED' : String(row?.positionType || row?.state || 'OPEN').toUpperCase());

  return {
    id: String(row?.securityId || row?.positionId || row?.id || `${symbol}-${source}`),
    symbol,
    broker: 'dhan',
    product_type: String(row?.productType || row?.product || (source === 'holding' ? 'DELIVERY' : 'INTRADAY')).toUpperCase(),
    net_qty: qty,
    avg_price: avgPrice,
    avg_exit_price: num(row?.sellAvg),
    ltp,
    realized_pnl: realized,
    unrealized_pnl: unrealized,
    state,
    next_move: 'Hold',
    updated_at: row?.updatedAt || row?.updated_at || row?.timestamp || new Date().toISOString(),
  };
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
      let resolvedPositions = Array.isArray(posRows) ? posRows : [];
      let resolvedOrders = (Array.isArray(orderRows) ? orderRows : []).filter(isLiveExecution);

      // Fallback to broker live data when local trade tables are empty.
      if (!resolvedPositions.length && !resolvedOrders.length) {
        try {
          const [dhanPosRows, dhanHoldRows, dhanOrderRows] = await Promise.all([
            fetchDhanPositions({ userId }),
            fetchDhanHoldings({ userId }),
            fetchDhanOrders({ userId }),
          ]);
          const mappedLiveRows = [
            ...(Array.isArray(dhanPosRows) ? dhanPosRows : []).map((row) => mapDhanRowToPortfolioPosition(row, 'position')),
            ...(Array.isArray(dhanHoldRows) ? dhanHoldRows : []).map((row) => mapDhanRowToPortfolioPosition(row, 'holding')),
          ].filter((row) => row.symbol);
          const byKey = new Map();
          mappedLiveRows.forEach((row) => {
            const key = `${row.symbol}_${row.product_type}_${row.broker}`;
            if (!byKey.has(key)) byKey.set(key, row);
          });
          resolvedPositions = Array.from(byKey.values());
          resolvedOrders = (Array.isArray(dhanOrderRows) ? dhanOrderRows : []).filter(isLiveExecution);
        } catch (_) {
          // keep primary API result when Dhan fallback is unavailable
        }
      }

      setPositions(resolvedPositions);
      setOrders(resolvedOrders);
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
      const qty = num(row?.net_qty);
      const state = String(row?.state || '').toUpperCase();
      if (qty <= 0 || state === 'CLOSED') {
        closed.push({ ...row, state: 'CLOSED', net_qty: qty });
      } else {
        open.push({ ...row, state: 'OPEN', net_qty: qty });
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
                      <TableCell>Execution</TableCell>
                      <TableCell>Broker Order ID</TableCell>
                      <TableCell>Broker Response</TableCell>
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
                        <TableCell>
                          <Chip
                            size="small"
                            label={row.status || '—'}
                            color={orderStatusColor[String(row.status || '').toUpperCase()] || 'default'}
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>{String(row.execution_mode || 'live').toUpperCase()}</TableCell>
                        <TableCell>{row.broker_order_id || '—'}</TableCell>
                        <TableCell sx={{ maxWidth: 260 }}>
                          {row.rejection_reason ? (
                            <Tooltip title={String(row.rejection_reason)}>
                              <span>{String(row.rejection_reason).slice(0, 80)}{String(row.rejection_reason).length > 80 ? '…' : ''}</span>
                            </Tooltip>
                          ) : (
                            row.broker_response
                              ? (
                                <Tooltip title={typeof row.broker_response === 'string' ? row.broker_response : JSON.stringify(row.broker_response)}>
                                  <span>Broker ack received</span>
                                </Tooltip>
                              )
                              : '—'
                          )}
                        </TableCell>
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
