import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControlLabel,
  MenuItem,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { fetchVideoStrategySignals } from '../api/advisor';

const fmt = (v, d = 2) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(d) : '—';
};

function VideoStrategyScreenerPage() {
  const [universe, setUniverse] = useState('all');
  const [symbolsInput, setSymbolsInput] = useState('');
  const [limit, setLimit] = useState(200);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ cached: false, scan_symbols: 0, count: 0 });
  const [sortConfig, setSortConfig] = useState({ key: 'score', ascending: false });

  const load = useCallback(async (opts = {}) => {
    if (loading || refreshing) return;
    if (hasLoadedOnce) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const payload = await fetchVideoStrategySignals({
        limit,
        symbols: symbolsInput,
        universe,
        refresh: Boolean(opts.forceRefresh),
        cacheTtlSec: 180,
        sendTelegram: Boolean(opts.sendTelegram),
      });
      setRows(Array.isArray(payload?.data) ? payload.data : []);
      setMeta({
        cached: Boolean(payload?.cached),
        scan_symbols: Number(payload?.scan_symbols || 0),
        count: Number(payload?.count || 0),
      });
    } catch (e) {
      setError(e?.message || 'Failed to load video strategy screener.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setHasLoadedOnce(true);
    }
  }, [limit, symbolsInput, universe, hasLoadedOnce, loading, refreshing]);

  useEffect(() => {
    load({ forceRefresh: true });
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const id = setInterval(() => load({ forceRefresh: false }), 60000);
    return () => clearInterval(id);
  }, [autoRefresh, load]);

  const handleSort = useCallback((key) => {
    setSortConfig((prev) => ({
      key,
      ascending: prev.key === key ? !prev.ascending : true,
    }));
  }, []);

  const sortedRows = useMemo(() => {
    const data = [...rows];
    const getVal = (row, key) => {
      switch (key) {
        case 'symbol': return String(row?.symbol || '');
        case 'strategy': return String(row?.strategy || '');
        case 'bias': return String(row?.daily_bias || row?.bias || '');
        case 'h4_trend': return String(row?.h4_trend || '');
        case 'h1_trend': return String(row?.h1_trend || '');
        case 'trigger_tf': return String(row?.trigger_tf || '');
        case 'mtf_alignment': return Number(row?.mtf_alignment ?? Number.NEGATIVE_INFINITY);
        case 'side': return String(row?.side || '');
        case 'entry': return Number(row?.entry ?? Number.NEGATIVE_INFINITY);
        case 'stop_loss': return Number(row?.stop_loss ?? Number.NEGATIVE_INFINITY);
        case 'target_1': return Number(row?.target_1 ?? Number.NEGATIVE_INFINITY);
        case 'rr': return Number(row?.rr ?? Number.NEGATIVE_INFINITY);
        case 'score': return Number(row?.score ?? Number.NEGATIVE_INFINITY);
        case 'signal_time': return String(row?.signal_time || '');
        default: return '';
      }
    };
    data.sort((a, b) => {
      const va = getVal(a, sortConfig.key);
      const vb = getVal(b, sortConfig.key);
      if (typeof va === 'string' || typeof vb === 'string') {
        const cmp = String(va).localeCompare(String(vb));
        return sortConfig.ascending ? cmp : -cmp;
      }
      const cmp = (va || 0) - (vb || 0);
      return sortConfig.ascending ? cmp : -cmp;
    });
    return data;
  }, [rows, sortConfig]);

  const getSortArrow = useCallback((key) => {
    if (sortConfig.key !== key) return ' ⬍';
    return sortConfig.ascending ? ' ↑' : ' ↓';
  }, [sortConfig]);

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
        Video Strategy Screener ({meta.count})
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Multi-timeframe setup: 1D bias + 4H trend + 1H trend alignment, with 5m trigger scanner.
      </Typography>

      <Box
        sx={{
          display: 'flex',
          gap: 1,
          flexWrap: 'wrap',
          alignItems: 'center',
          p: 1.5,
          borderRadius: 2,
          border: '1px solid rgba(255,255,255,0.12)',
          mb: 2,
        }}
      >
        <TextField
          select
          size="small"
          label="Universe"
          value={universe}
          onChange={(e) => setUniverse(e.target.value)}
          sx={{ minWidth: 140 }}
        >
          <MenuItem value="watchlist">Watchlist</MenuItem>
          <MenuItem value="all">All Symbols</MenuItem>
        </TextField>
        <TextField
          size="small"
          type="number"
          label="Limit"
          value={limit}
          onChange={(e) => setLimit(Math.max(1, Math.min(1000, Number(e.target.value || 1))))}
          sx={{ width: 110 }}
        />
        <TextField
          size="small"
          label="Symbols (optional CSV)"
          value={symbolsInput}
          onChange={(e) => setSymbolsInput(e.target.value)}
          sx={{ minWidth: 280, background: '#fff' }}
        />
        <FormControlLabel control={<Switch checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />} label="Auto 60s" />
        <Button variant="outlined" onClick={() => load({ forceRefresh: true })} disabled={loading || refreshing}>Scan</Button>
        <Button variant="contained" color="success" onClick={() => load({ forceRefresh: true, sendTelegram: true })} disabled={loading || refreshing}>
          Send Telegram
        </Button>
        {refreshing ? <Chip size="small" color="info" label="Refreshing..." /> : null}
      </Box>

      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
        Scanned: {meta.scan_symbols} | Universe: {universe === 'all' ? 'All Symbols' : 'Watchlist'} | Cache: {meta.cached ? 'hit' : 'fresh'}
      </Typography>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      {loading ? (
        <Box sx={{ py: 5, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      ) : null}
      {!loading && hasLoadedOnce && rows.length === 0 ? (
        <Alert severity="info">No video-strategy setups matched right now.</Alert>
      ) : null}

      {rows.length > 0 ? (
        <TableContainer sx={{ overflowX: 'auto', borderRadius: 2, border: '1px solid rgba(255,255,255,0.12)' }}>
          <Table size="small" sx={{ minWidth: 1300 }}>
            <TableHead>
              <TableRow>
                <TableCell onClick={() => handleSort('symbol')} sx={{ cursor: 'pointer' }}>Symbol{getSortArrow('symbol')}</TableCell>
                <TableCell onClick={() => handleSort('strategy')} sx={{ cursor: 'pointer' }}>Strategy{getSortArrow('strategy')}</TableCell>
                <TableCell onClick={() => handleSort('bias')} sx={{ cursor: 'pointer' }}>Bias{getSortArrow('bias')}</TableCell>
                <TableCell onClick={() => handleSort('h4_trend')} sx={{ cursor: 'pointer' }}>4H Trend{getSortArrow('h4_trend')}</TableCell>
                <TableCell onClick={() => handleSort('h1_trend')} sx={{ cursor: 'pointer' }}>1H Trend{getSortArrow('h1_trend')}</TableCell>
                <TableCell onClick={() => handleSort('trigger_tf')} sx={{ cursor: 'pointer' }}>Trigger TF{getSortArrow('trigger_tf')}</TableCell>
                <TableCell align="right" onClick={() => handleSort('mtf_alignment')} sx={{ cursor: 'pointer' }}>MTF Score{getSortArrow('mtf_alignment')}</TableCell>
                <TableCell onClick={() => handleSort('side')} sx={{ cursor: 'pointer' }}>Side{getSortArrow('side')}</TableCell>
                <TableCell align="right" onClick={() => handleSort('entry')} sx={{ cursor: 'pointer' }}>Entry{getSortArrow('entry')}</TableCell>
                <TableCell align="right" onClick={() => handleSort('stop_loss')} sx={{ cursor: 'pointer' }}>SL{getSortArrow('stop_loss')}</TableCell>
                <TableCell align="right" onClick={() => handleSort('target_1')} sx={{ cursor: 'pointer' }}>Target{getSortArrow('target_1')}</TableCell>
                <TableCell align="right" onClick={() => handleSort('rr')} sx={{ cursor: 'pointer' }}>R:R{getSortArrow('rr')}</TableCell>
                <TableCell align="right" onClick={() => handleSort('score')} sx={{ cursor: 'pointer' }}>Score{getSortArrow('score')}</TableCell>
                <TableCell>Reason</TableCell>
                <TableCell onClick={() => handleSort('signal_time')} sx={{ cursor: 'pointer' }}>Signal Time{getSortArrow('signal_time')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedRows.map((r) => {
                const isBull = String(r?.side || '').toUpperCase() === 'LONG';
                const bg = isBull ? 'rgba(76, 175, 80, 0.12)' : 'rgba(244, 67, 54, 0.12)';
                return (
                  <TableRow key={`${r.symbol}_${r.strategy}_${r.signal_time}`} sx={{ backgroundColor: bg }}>
                    <TableCell sx={{ fontWeight: 700 }}>{r.symbol}</TableCell>
                    <TableCell><Chip size="small" label={r.strategy} variant="outlined" /></TableCell>
                    <TableCell>{r.daily_bias || r.bias}</TableCell>
                    <TableCell>{r.h4_trend || '—'}</TableCell>
                    <TableCell>{r.h1_trend || '—'}</TableCell>
                    <TableCell>{r.trigger_tf || '5m'}</TableCell>
                    <TableCell align="right">{fmt(r.mtf_alignment, 0)}</TableCell>
                    <TableCell>{r.side}</TableCell>
                    <TableCell align="right">{fmt(r.entry, 2)}</TableCell>
                    <TableCell align="right">{fmt(r.stop_loss, 2)}</TableCell>
                    <TableCell align="right">{fmt(r.target_1, 2)}</TableCell>
                    <TableCell align="right">{fmt(r.rr, 2)}</TableCell>
                    <TableCell align="right">{fmt(r.score, 1)}</TableCell>
                    <TableCell>{r.reason}</TableCell>
                    <TableCell>{r.signal_time || '—'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      ) : null}
    </Box>
  );
}

export default VideoStrategyScreenerPage;

