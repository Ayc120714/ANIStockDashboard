import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Snackbar,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { TableSection, TableTitle, TableWrapper, Table } from './SectorOutlook.styles';
import AlertTradeActions from '../components/Header/AlertTradeActions';
import OrderPanel from '../components/OrderPanel';
import {
  fetchLiveSetupsPayload,
  partitionEntryReadySetups,
} from '../utils/liveSetupsPayload';
import { runLiveMarketPageMountPoll, runScreenTableFetch } from '../utils/screenPageLoader';
import { formatAlertTimeIST } from '../utils/alertInboxUtils';
import {
  buildEntryReadyPopupMessage,
  detectNewEntryReadySetups,
  notifyEntryReadyBrowser,
} from '../utils/entryReadySetupAlerts';
import { buildProductProfilesFromAlertDetail } from '../utils/alertTradeSetup';
import { getSetupLifecycleState, setupRowToTradeDetail } from '../utils/setupLifecycle';

const fmtRupee = (v) => {
  if (v == null || v === '' || Number.isNaN(Number(v))) return '—';
  return `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const compact = { fontSize: 12, padding: '4px 6px', whiteSpace: 'nowrap' };

function statusChipColor(label) {
  if (label === 'ENTRY READY') return { bg: '#e3f2fd', color: '#1565c0' };
  if (label === 'IN TRADE' || label === 'T1 HIT') return { bg: '#e8f5e9', color: '#2e7d32' };
  if (label === 'SL HIT' || label === 'T2 / DONE') return { bg: '#ffebee', color: '#c62828' };
  return { bg: '#f3f4f6', color: '#374151' };
}

const LIVE_SETUPS_CACHE_KEY = 'liveSetupsEntryReady_v1';

function LiveSetupsPage() {
  const [searchParams] = useSearchParams();
  const focusSymbol = String(searchParams.get('symbol') || '').trim().toUpperCase();
  const [period, setPeriod] = useState('today');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [symbolFilter, setSymbolFilter] = useState(focusSymbol);
  const [selectedSymbol, setSelectedSymbol] = useState(focusSymbol);
  const [popupMessage, setPopupMessage] = useState('');
  const firstLoad = useRef(true);

  const applyRows = useCallback((list) => {
    const rowsList = Array.isArray(list) ? list : [];
    const { fresh } = detectNewEntryReadySetups(rowsList, { bootstrap: firstLoad.current });
    firstLoad.current = false;
    if (fresh.length) {
      const message = buildEntryReadyPopupMessage(fresh);
      setPopupMessage(message);
      notifyEntryReadyBrowser(fresh);
    }
    setRows(rowsList);
  }, []);

  const load = useCallback(async ({ silent = false, forceNetwork = false } = {}) => {
    setError('');
    await runScreenTableFetch({
      cacheKey: LIVE_SETUPS_CACHE_KEY,
      fetcher: async () => fetchLiveSetupsPayload(),
      setRows: applyRows,
      setLoading: (v) => { if (!silent) setLoading(v); },
      setError: (msg) => setError(msg || ''),
      forceNetwork,
      silent,
    });
  }, [applyRows]);

  useEffect(() => {
    let cleanup;
    (async () => {
      await runLiveMarketPageMountPoll({
        load,
        liveIntervalMs: 30_000,
        onCleanup: (fn) => { cleanup = fn; },
      });
    })();
    return () => cleanup?.();
  }, [load]);

  useEffect(() => {
    if (focusSymbol) {
      setSymbolFilter(focusSymbol);
      setSelectedSymbol(focusSymbol);
    }
  }, [focusSymbol]);

  const partitioned = useMemo(() => partitionEntryReadySetups(rows), [rows]);

  const visibleRows = useMemo(() => {
    const base = period === 'today' ? partitioned.today : partitioned.week;
    const q = String(symbolFilter || '').trim().toUpperCase();
    if (!q) return base;
    return base.filter((row) => String(row.symbol || '').includes(q));
  }, [partitioned, period, symbolFilter]);

  const selectedRow = useMemo(
    () => visibleRows.find((row) => row.symbol === selectedSymbol)
      || partitioned.all.find((row) => row.symbol === selectedSymbol)
      || null,
    [partitioned.all, selectedSymbol, visibleRows],
  );

  const symbolProfiles = useMemo(() => {
    const map = {};
    for (const row of partitioned.all) {
      if (!row?.symbol) continue;
      const detail = setupRowToTradeDetail(row);
      map[row.symbol] = buildProductProfilesFromAlertDetail(detail);
    }
    return map;
  }, [rows]);

  const symbolPrices = useMemo(() => {
    const map = {};
    for (const row of partitioned.all) {
      const cmp = Number(row?.cmp);
      if (row?.symbol && Number.isFinite(cmp) && cmp > 0) map[row.symbol] = cmp;
    }
    return map;
  }, [rows]);

  return (
    <TableSection>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5, flexWrap: 'wrap' }}>
        <TableTitle style={{ margin: 0 }}>Entry Ready Alerts</TableTitle>
        <Chip size="small" label={`Today ${partitioned.today.length}`} color={period === 'today' ? 'primary' : 'default'} />
        <Chip size="small" label={`This week ${partitioned.week.length}`} color={period === 'week' ? 'primary' : 'default'} />
        <Button size="small" variant="outlined" onClick={() => load()} disabled={loading} sx={{ ml: 'auto', textTransform: 'none' }}>
          Refresh
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Entry-ready stocks you can take as live alerts. New setups trigger a popup notification. Use Buy/Sell with MIS, MTF, or Delivery to place trades.
      </Typography>

      <Snackbar
        open={Boolean(popupMessage)}
        autoHideDuration={12_000}
        onClose={() => setPopupMessage('')}
        message={popupMessage}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        ContentProps={{ sx: { bgcolor: '#1565c0', color: '#fff', fontWeight: 600 } }}
      />

      {error ? <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert> : null}

      <Tabs
        value={period}
        onChange={(_, value) => setPeriod(value)}
        sx={{ mb: 1.5, minHeight: 36 }}
      >
        <Tab value="today" label={`Today (${partitioned.today.length})`} sx={{ textTransform: 'none', minHeight: 36 }} />
        <Tab value="week" label={`This week (${partitioned.week.length})`} sx={{ textTransform: 'none', minHeight: 36 }} />
      </Tabs>

      <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          label="Filter symbol"
          value={symbolFilter}
          onChange={(e) => setSymbolFilter(String(e.target.value || '').toUpperCase())}
          sx={{ minWidth: 180 }}
        />
      </Box>

      {selectedRow ? (
        <Box sx={{ mb: 2 }}>
          <AlertTradeActions detail={setupRowToTradeDetail(selectedRow)} />
        </Box>
      ) : null}

      <OrderPanel
        defaultSymbol={selectedSymbol}
        symbolOptions={partitioned.all.map((row) => row.symbol)}
        symbolPrices={symbolPrices}
        symbolProfiles={symbolProfiles}
        hideBrokerSelector
      />

      {loading && !rows.length ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : null}

      {!loading && !visibleRows.length ? (
        <Alert severity="info">
          No entry-ready {period === 'today' ? 'today' : 'weekly'} alerts right now. You will get a popup when a new stock becomes entry ready.
        </Alert>
      ) : null}

      {visibleRows.length ? (
        <TableWrapper>
          <Table>
            <thead>
              <tr>
                {['Symbol', 'Status', 'CMP', 'Entry', 'SL', 'T1', 'T2', 'Generated', 'Alert', ''].map((label) => (
                  <th key={label || 'actions'} style={compact}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => {
                const lifecycle = getSetupLifecycleState(row);
                const tone = statusChipColor(lifecycle.statusLabel);
                const selected = row.symbol === selectedSymbol;
                return (
                  <tr
                    key={`${row.symbol}-${row.id || row._alertAt || 'row'}`}
                    style={{ background: selected ? 'rgba(37, 99, 235, 0.08)' : undefined, cursor: 'pointer' }}
                    onClick={() => setSelectedSymbol(row.symbol)}
                  >
                    <td style={{ ...compact, fontWeight: 700 }}>{row.symbol}</td>
                    <td style={compact}>
                      <Chip
                        size="small"
                        label={lifecycle.statusLabel}
                        sx={{ fontSize: 10, fontWeight: 700, bgcolor: tone.bg, color: tone.color }}
                      />
                    </td>
                    <td style={compact}>{fmtRupee(row.cmp)}</td>
                    <td style={compact}>{fmtRupee(row.entry_price)}</td>
                    <td style={compact}>{fmtRupee(lifecycle.effectiveStopLoss ?? row.stop_loss)}</td>
                    <td style={compact}>{fmtRupee(row.target_1)}</td>
                    <td style={compact}>{fmtRupee(row.target_2)}</td>
                    <td style={compact}>{formatAlertTimeIST(row._alertAt || row.setup_at || row.scan_time)}</td>
                    <td style={{ ...compact, maxWidth: 220, whiteSpace: 'normal' }}>
                      {row._alertMessage || row.message || row._alertType || '—'}
                    </td>
                    <td style={compact}>
                      <Button
                        size="small"
                        variant={selected ? 'contained' : 'outlined'}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSymbol(row.symbol);
                        }}
                        sx={{ textTransform: 'none', fontSize: 11 }}
                      >
                        Trade
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </TableWrapper>
      ) : null}
    </TableSection>
  );
}

export default LiveSetupsPage;
