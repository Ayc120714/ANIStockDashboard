import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControlLabel,
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
import { fetchBullishVolume5m } from '../api/bullishVolume5m';
import { addToWatchlist } from '../api/watchlist';
import { ensureMarketSession, getMarketPollingIntervalMs } from '../utils/marketSession';

const fmt = (v, d = 2) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(d) : '—';
};

const CRITERIA = [
  '5m close crosses above EMA(21)',
  '5m close > EMA(200)',
  'Volume / EMA(volume, 21) > 2',
  'CVD resets each IST session; bar delta > 0; session CVD rising vs prior bar',
  'Session CVD > prior trading day close CVD',
];

function BullishVolume5mPage() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ scanned: 0, count: 0, cached: false, criteria: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [volRatio, setVolRatio] = useState('2');
  const [universe, setUniverse] = useState('sector');
  const [requireCvd, setRequireCvd] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRun, setLastRun] = useState(null);

  const load = useCallback(async (opts = {}) => {
    const silent = Boolean(opts.silent);
    if (!silent) setLoading(true);
    setError('');
    try {
      const payload = await fetchBullishVolume5m({
        limit: 350,
        result_limit: 150,
        universe,
        vol_ratio_min: Number(volRatio) || 2,
        require_cvd: requireCvd,
        refresh: Boolean(opts.refresh),
      });
      setRows(Array.isArray(payload?.data) ? payload.data : []);
      setMeta({
        scanned: payload?.scanned ?? 0,
        count: payload?.count ?? 0,
        cached: payload?.cached ?? false,
        criteria: payload?.criteria ?? {},
        skipped: payload?.skipped_insufficient_bars ?? 0,
        as_of: payload?.as_of,
      });
      setLastRun(new Date());
    } catch (e) {
      setError(e?.message || 'Failed to load 5m bullish volume screener.');
      setRows([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [universe, volRatio, requireCvd]);

  useEffect(() => {
    let timer;
    let mounted = true;
    (async () => {
      await load();
      if (!mounted) return;
      await ensureMarketSession();
      const pollMs = getMarketPollingIntervalMs(90000, 0);
      if (autoRefresh && pollMs > 0) {
        timer = setInterval(() => {
          if (mounted) load({ silent: true, refresh: true });
        }, pollMs);
      }
    })();
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [load, autoRefresh]);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => Number(b.volume_ratio || 0) - Number(a.volume_ratio || 0)),
    [rows],
  );

  const handleAddWatchlist = async (symbol) => {
    try {
      await addToWatchlist(symbol, 'short_term', 'bullish_vol_5m');
    } catch (_) {
      /* ignore */
    }
  };

  return (
    <Box sx={{ p: { xs: 1, md: 0 } }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Live scan across the universe on 5-minute bars. CVD is cumulative volume delta with a
        <strong> fresh reset each trading day</strong>; prior session close is used to judge net buying vs yesterday.
      </Typography>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2, alignItems: 'center' }}>
        <TextField
          select
          size="small"
          label="Universe"
          value={universe}
          onChange={(e) => setUniverse(e.target.value)}
          SelectProps={{ native: true }}
          sx={{ minWidth: 140 }}
        >
          <option value="sector">All stocks</option>
          <option value="watchlist">Watchlist</option>
          <option value="union">Sector + watchlist</option>
        </TextField>
        <TextField
          size="small"
          label="Min vol / EMA(21)"
          type="number"
          inputProps={{ min: 1, step: 0.1 }}
          value={volRatio}
          onChange={(e) => setVolRatio(e.target.value)}
          sx={{ width: 130 }}
        />
        <FormControlLabel
          control={<Switch checked={requireCvd} onChange={(e) => setRequireCvd(e.target.checked)} />}
          label="Require CVD bullish"
        />
        <FormControlLabel
          control={<Switch checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />}
          label="Auto refresh"
        />
        <Button size="small" variant="outlined" onClick={() => load({ refresh: true })} disabled={loading}>
          Refresh
        </Button>
        {lastRun ? (
          <Typography variant="caption" color="text.secondary">
            Updated {lastRun.toLocaleTimeString()}
            {meta.cached ? ' (cached)' : ''}
          </Typography>
        ) : null}
      </Box>

      <Box sx={{ mb: 2 }}>
        {CRITERIA.map((line) => (
          <Typography key={line} variant="caption" display="block" color="text.secondary">
            • {line}
          </Typography>
        ))}
      </Box>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      <Typography variant="body2" sx={{ mb: 1 }}>
        Scanned {meta.scanned} symbols — <strong>{meta.count}</strong> matches
        {meta.skipped ? ` (${meta.skipped} skipped: insufficient 5m history)` : ''}
      </Typography>

      {loading && !rows.length ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Symbol</TableCell>
                <TableCell>Bar time</TableCell>
                <TableCell align="right">Close</TableCell>
                <TableCell align="right">EMA21</TableCell>
                <TableCell align="right">EMA200</TableCell>
                <TableCell align="right">Vol ratio</TableCell>
                <TableCell align="right">CVD session</TableCell>
                <TableCell align="right">CVD bar Δ</TableCell>
                <TableCell align="right">Prior day CVD</TableCell>
                <TableCell align="right">vs prior day</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} sx={{ color: '#777', py: 3 }}>
                    No symbols match right now. During market hours, refresh after a 5m bar closes
                    with EMA21 cross, high relative volume, and bullish CVD.
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((r) => (
                  <TableRow key={r.symbol} hover>
                    <TableCell sx={{ fontWeight: 700 }}>{r.symbol}</TableCell>
                    <TableCell sx={{ fontSize: 12 }}>
                      {r.bar_time ? String(r.bar_time).replace('T', ' ').slice(0, 19) : '—'}
                    </TableCell>
                    <TableCell align="right">{fmt(r.close)}</TableCell>
                    <TableCell align="right">{fmt(r.ema21)}</TableCell>
                    <TableCell align="right">{fmt(r.ema200)}</TableCell>
                    <TableCell align="right">
                      <Chip size="small" label={fmt(r.volume_ratio)} color="primary" />
                    </TableCell>
                    <TableCell align="right">{fmt(r.cvd_session, 0)}</TableCell>
                    <TableCell align="right">{fmt(r.cvd_bar_delta, 0)}</TableCell>
                    <TableCell align="right">{fmt(r.prior_day_cvd_close, 0)}</TableCell>
                    <TableCell align="right">{fmt(r.cvd_vs_prior_day, 0)}</TableCell>
                    <TableCell>
                      <Button size="small" onClick={() => handleAddWatchlist(r.symbol)}>
                        + WL
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}

export default BullishVolume5mPage;
