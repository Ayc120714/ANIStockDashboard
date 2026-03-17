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
  const [side, setSide] = useState('both');
  const [symbolsInput, setSymbolsInput] = useState('');
  const [limit, setLimit] = useState(200);
  const [relVolThreshold, setRelVolThreshold] = useState(2.0);
  const [displacementMult, setDisplacementMult] = useState(1.8);
  const [levelToleranceBps, setLevelToleranceBps] = useState(8.0);
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
        side,
        relVolThreshold,
        displacementMult,
        levelToleranceBps,
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
  }, [limit, symbolsInput, universe, side, relVolThreshold, displacementMult, levelToleranceBps, hasLoadedOnce, loading, refreshing]);

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
        case 'trigger_level': return String(row?.trigger_level || '');
        case 'cisd_level': return Number(row?.cisd_level ?? Number.NEGATIVE_INFINITY);
        case 'h4_trend': return String(row?.h4_trend || '');
        case 'h1_trend': return String(row?.h1_trend || '');
        case 'trigger_tf': return String(row?.trigger_tf || '');
        case 'mtf_probability': return String(row?.mtf_probability || '');
        case 'side': return String(row?.side || '');
        case 'entry': return Number(row?.entry ?? Number.NEGATIVE_INFINITY);
        case 'stop_loss': return Number(row?.stop_loss ?? Number.NEGATIVE_INFINITY);
        case 'target_1': return Number(row?.target_1 ?? Number.NEGATIVE_INFINITY);
        case 'target_2': return Number(row?.target_2 ?? Number.NEGATIVE_INFINITY);
        case 'rr1': return Number(row?.rr1 ?? Number.NEGATIVE_INFINITY);
        case 'rr2': return Number(row?.rr2 ?? Number.NEGATIVE_INFINITY);
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
        Weekly low/mid/high reclaim strategy with CISD confirmation on 15m and 4H -> 1H -> 5m probability context.
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
          select
          size="small"
          label="Side"
          value={side}
          onChange={(e) => setSide(e.target.value)}
          sx={{ minWidth: 130 }}
        >
          <MenuItem value="both">Both</MenuItem>
          <MenuItem value="bullish">Bullish</MenuItem>
          <MenuItem value="bearish">Bearish</MenuItem>
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
          type="number"
          label="Rel Vol"
          value={relVolThreshold}
          onChange={(e) => setRelVolThreshold(Math.max(1, Number(e.target.value || 1)))}
          sx={{ width: 110 }}
        />
        <TextField
          size="small"
          type="number"
          label="Displacement"
          value={displacementMult}
          onChange={(e) => setDisplacementMult(Math.max(1, Number(e.target.value || 1)))}
          sx={{ width: 130 }}
        />
        <TextField
          size="small"
          type="number"
          label="Tol (bps)"
          value={levelToleranceBps}
          onChange={(e) => setLevelToleranceBps(Math.max(0, Number(e.target.value || 0)))}
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
                <TableCell onClick={() => handleSort('trigger_level')} sx={{ cursor: 'pointer' }}>Level{getSortArrow('trigger_level')}</TableCell>
                <TableCell align="right" onClick={() => handleSort('cisd_level')} sx={{ cursor: 'pointer' }}>CISD{getSortArrow('cisd_level')}</TableCell>
                <TableCell onClick={() => handleSort('h4_trend')} sx={{ cursor: 'pointer' }}>4H Trend{getSortArrow('h4_trend')}</TableCell>
                <TableCell onClick={() => handleSort('h1_trend')} sx={{ cursor: 'pointer' }}>1H Trend{getSortArrow('h1_trend')}</TableCell>
                <TableCell onClick={() => handleSort('trigger_tf')} sx={{ cursor: 'pointer' }}>Trigger TF{getSortArrow('trigger_tf')}</TableCell>
                <TableCell onClick={() => handleSort('mtf_probability')} sx={{ cursor: 'pointer' }}>Probability{getSortArrow('mtf_probability')}</TableCell>
                <TableCell onClick={() => handleSort('side')} sx={{ cursor: 'pointer' }}>Side{getSortArrow('side')}</TableCell>
                <TableCell align="right" onClick={() => handleSort('entry')} sx={{ cursor: 'pointer' }}>Entry{getSortArrow('entry')}</TableCell>
                <TableCell align="right" onClick={() => handleSort('stop_loss')} sx={{ cursor: 'pointer' }}>SL{getSortArrow('stop_loss')}</TableCell>
                <TableCell align="right" onClick={() => handleSort('target_1')} sx={{ cursor: 'pointer' }}>Target{getSortArrow('target_1')}</TableCell>
                <TableCell align="right" onClick={() => handleSort('target_2')} sx={{ cursor: 'pointer' }}>Target 2{getSortArrow('target_2')}</TableCell>
                <TableCell align="right" onClick={() => handleSort('rr1')} sx={{ cursor: 'pointer' }}>R:R1{getSortArrow('rr1')}</TableCell>
                <TableCell align="right" onClick={() => handleSort('rr2')} sx={{ cursor: 'pointer' }}>R:R2{getSortArrow('rr2')}</TableCell>
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
                    <TableCell>{r.trigger_level || '—'}</TableCell>
                    <TableCell align="right">{fmt(r.cisd_level, 2)}</TableCell>
                    <TableCell>{r.h4_trend || '—'}</TableCell>
                    <TableCell>{r.h1_trend || '—'}</TableCell>
                    <TableCell>{r.trigger_tf || '15m'}</TableCell>
                    <TableCell>{r.mtf_probability || '—'}</TableCell>
                    <TableCell>{r.side}</TableCell>
                    <TableCell align="right">{fmt(r.entry, 2)}</TableCell>
                    <TableCell align="right">{fmt(r.stop_loss, 2)}</TableCell>
                    <TableCell align="right">{fmt(r.target_1, 2)}</TableCell>
                    <TableCell align="right">{fmt(r.target_2, 2)}</TableCell>
                    <TableCell align="right">{fmt(r.rr1, 2)}</TableCell>
                    <TableCell align="right">{fmt(r.rr2, 2)}</TableCell>
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

