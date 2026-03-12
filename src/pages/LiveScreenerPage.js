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
import { fetchIndicatorScreenerMultiSignals } from '../api/advisor';

const fmt = (v, d = 2) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(d) : '—';
};

const INDICATORS = [
  { value: 'rsi', label: 'RSI' },
  { value: 'macd', label: 'MACD' },
  { value: 'macd_signal', label: 'MACD Signal' },
  { value: 'macd_histogram', label: 'MACD Histogram' },
  { value: 'volume_ratio', label: 'Relative Volume' },
  { value: 'relative_strength', label: 'Relative Strength' },
  { value: 'adx', label: 'ADX' },
  { value: 'cci', label: 'CCI' },
  { value: 'ema5', label: 'EMA 5' },
  { value: 'ema21', label: 'EMA 21' },
  { value: 'ema200', label: 'EMA 200' },
  { value: 'vwap', label: 'VWAP' },
  { value: 'psar', label: 'PSAR' },
];

const CONDITIONS = [
  { value: 'cross_above', label: 'Cross Above' },
  { value: 'cross_below', label: 'Cross Below' },
  { value: 'gt', label: 'Greater Than' },
  { value: 'gte', label: 'Greater Than or Equal' },
  { value: 'lt', label: 'Less Than' },
  { value: 'lte', label: 'Less Than or Equal' },
  { value: 'eq', label: 'Equal To' },
];

function LiveScreenerPage() {
  const [timeframe, setTimeframe] = useState('monthly');
  const [universe, setUniverse] = useState('all');
  const [indicator, setIndicator] = useState('rsi');
  const [condition, setCondition] = useState('cross_above');
  const [valueInput, setValueInput] = useState('50');
  const [compareIndicator, setCompareIndicator] = useState('');
  const [rules, setRules] = useState([
    { indicator: 'rsi', condition: 'cross_above', value: 50, compare_indicator: '' },
  ]);
  const [symbolsInput, setSymbolsInput] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ cached: false, scan_symbols: 0, count: 0 });
  const [sortConfig, setSortConfig] = useState({ key: 'score', ascending: false });

  const canUseThreshold = !compareIndicator;
  const numericValue = canUseThreshold && String(valueInput).trim() !== '' ? Number(valueInput) : null;

  const draftRuleLabel = useMemo(() => {
    const right = compareIndicator ? compareIndicator.toUpperCase() : (numericValue ?? '');
    return `${indicator.toUpperCase()} ${condition.toUpperCase()} ${right}`;
  }, [indicator, condition, compareIndicator, numericValue]);

  const addRule = useCallback(() => {
    if (!indicator || !condition) return;
    const next = {
      indicator,
      condition,
      value: compareIndicator ? null : numericValue,
      compare_indicator: compareIndicator || '',
    };
    setRules((prev) => [...prev, next]);
  }, [indicator, condition, compareIndicator, numericValue]);

  const removeRule = useCallback((idx) => {
    setRules((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const clearRules = useCallback(() => {
    setRules([]);
  }, []);

  const effectiveRules = useMemo(() => {
    if (rules.length > 0) return rules;
    return [{
      indicator,
      condition,
      value: compareIndicator ? null : numericValue,
      compare_indicator: compareIndicator || '',
    }];
  }, [rules, indicator, condition, compareIndicator, numericValue]);

  const load = useCallback(async (opts = {}) => {
    setLoading(true);
    setError('');
    try {
      const payload = await fetchIndicatorScreenerMultiSignals({
        timeframe,
        universe,
        rules: effectiveRules,
        symbols: symbolsInput,
        limit: 250,
        refresh: true,
        sendTelegram: Boolean(opts.sendTelegram),
      });
      setRows(Array.isArray(payload?.data) ? payload.data : []);
      setMeta({
        cached: Boolean(payload?.cached),
        scan_symbols: Number(payload?.scan_symbols || 0),
        count: Number(payload?.count || 0),
      });
    } catch (e) {
      setError(e?.message || 'Failed to load indicator screener.');
    } finally {
      setLoading(false);
    }
  }, [timeframe, universe, effectiveRules, symbolsInput]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const id = setInterval(() => load(), 60000);
    return () => clearInterval(id);
  }, [autoRefresh, load]);

  const presets = useMemo(
    () => ([
      {
        key: 'm_rsi_above_50',
        label: 'Monthly RSI Cross Above 50',
        apply: () => {
          setTimeframe('monthly');
          setRules([{ indicator: 'rsi', condition: 'cross_above', value: 50, compare_indicator: '' }]);
        },
      },
      {
        key: 'm_rsi_below_50',
        label: 'Monthly RSI Cross Below 50',
        apply: () => {
          setTimeframe('monthly');
          setRules([{ indicator: 'rsi', condition: 'cross_below', value: 50, compare_indicator: '' }]);
        },
      },
      {
        key: 'w_rsi_above_50',
        label: 'Weekly RSI Cross Above 50',
        apply: () => {
          setTimeframe('weekly');
          setRules([{ indicator: 'rsi', condition: 'cross_above', value: 50, compare_indicator: '' }]);
        },
      },
      {
        key: 'w_rsi_below_50',
        label: 'Weekly RSI Cross Below 50',
        apply: () => {
          setTimeframe('weekly');
          setRules([{ indicator: 'rsi', condition: 'cross_below', value: 50, compare_indicator: '' }]);
        },
      },
      {
        key: 'm_macd_cross_up',
        label: 'Monthly MACD Cross Above Signal',
        apply: () => {
          setTimeframe('monthly');
          setRules([{ indicator: 'macd', condition: 'cross_above', value: null, compare_indicator: 'macd_signal' }]);
        },
      },
      {
        key: 'm_macd_cross_down',
        label: 'Monthly MACD Cross Below Signal',
        apply: () => {
          setTimeframe('monthly');
          setRules([{ indicator: 'macd', condition: 'cross_below', value: null, compare_indicator: 'macd_signal' }]);
        },
      },
    ]),
    []
  );

  const title = `Live Indicator Screener (${meta.count})`;
  const prevLabel = timeframe === 'monthly' ? '1M Ago' : timeframe === 'weekly' ? '1W Ago' : 'Prev';
  const cmpLabel = 'Primary Rule RHS';

  const handleSort = useCallback((key) => {
    setSortConfig((prev) => ({
      key,
      ascending: prev.key === key ? !prev.ascending : true,
    }));
  }, []);

  const getSortArrow = useCallback((key) => {
    if (sortConfig.key !== key) return ' ⬍';
    return sortConfig.ascending ? ' ↑' : ' ↓';
  }, [sortConfig]);

  const sortedRows = useMemo(() => {
    const getVal = (row, key) => {
      switch (key) {
        case 'symbol': return String(row?.symbol || '');
        case 'rule': return String(row?.rule_text || '');
        case 'matched': return Number(Array.isArray(row?.matched_rules) ? row.matched_rules.length : 0);
        case 'current': return Number(row?.current_value ?? Number.NEGATIVE_INFINITY);
        case 'prev': return Number(row?.previous_value ?? Number.NEGATIVE_INFINITY);
        case 'rhs': return Number((row?.current_compare_value ?? row?.matched_rules?.[0]?.value) ?? Number.NEGATIVE_INFINITY);
        case 'rsi': return Number(row?.rsi ?? Number.NEGATIVE_INFINITY);
        case 'macd': return Number(row?.macd ?? Number.NEGATIVE_INFINITY);
        case 'signal': return Number(row?.macd_signal ?? Number.NEGATIVE_INFINITY);
        case 'hist': return Number(row?.macd_histogram ?? Number.NEGATIVE_INFINITY);
        case 'relVol': return Number(row?.volume_ratio ?? Number.NEGATIVE_INFINITY);
        case 'rs': return Number(row?.relative_strength ?? Number.NEGATIVE_INFINITY);
        case 'score': return Number(row?.signal_score ?? Number.NEGATIVE_INFINITY);
        case 'trend': return String(row?.trend || '');
        case 'date': return String(row?.signal_date || '');
        default: return '';
      }
    };

    const data = [...rows];
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

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>{title}</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
        Build multiple indicator rules and scan with AND condition (all rules must match).
      </Typography>

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
        {presets.map((preset) => (
          <Chip key={preset.key} label={preset.label} onClick={preset.apply} clickable color="primary" variant="outlined" />
        ))}
      </Box>

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
        <TextField select size="small" label="Timeframe" value={timeframe} onChange={(e) => setTimeframe(e.target.value)} sx={{ minWidth: 140 }}>
          <MenuItem value="daily">Daily</MenuItem>
          <MenuItem value="weekly">Weekly</MenuItem>
          <MenuItem value="monthly">Monthly</MenuItem>
        </TextField>
        <TextField select size="small" label="Universe" value={universe} onChange={(e) => setUniverse(e.target.value)} sx={{ minWidth: 140 }}>
          <MenuItem value="all">All Symbols</MenuItem>
          <MenuItem value="watchlist">Watchlist</MenuItem>
        </TextField>
        <TextField select size="small" label="Indicator" value={indicator} onChange={(e) => setIndicator(e.target.value)} sx={{ minWidth: 180 }}>
          {INDICATORS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
          ))}
        </TextField>
        <TextField select size="small" label="Condition" value={condition} onChange={(e) => setCondition(e.target.value)} sx={{ minWidth: 200 }}>
          {CONDITIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Compare With Indicator (Optional)"
          value={compareIndicator}
          onChange={(e) => setCompareIndicator(e.target.value)}
          sx={{ minWidth: 260 }}
        >
          <MenuItem value="">None (use threshold)</MenuItem>
          {INDICATORS.filter((x) => x.value !== indicator).map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          type="number"
          label="Threshold Value"
          value={valueInput}
          onChange={(e) => setValueInput(e.target.value)}
          disabled={!canUseThreshold}
          sx={{ width: 130 }}
        />
        <Button variant="outlined" onClick={addRule}>Add Rule (AND)</Button>
        <Button variant="text" color="warning" onClick={clearRules}>Clear Rules</Button>
        <TextField
          size="small"
          label="Symbols (optional CSV)"
          value={symbolsInput}
          onChange={(e) => setSymbolsInput(e.target.value)}
          sx={{ minWidth: 260, background: '#fff' }}
        />
        <FormControlLabel control={<Switch checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />} label="Auto 60s" />
        <Button variant="outlined" onClick={() => load()} disabled={loading}>Scan</Button>
        <Button variant="contained" color="success" onClick={() => load({ sendTelegram: true })} disabled={loading}>
          Send Telegram
        </Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
        {rules.map((r, idx) => {
          const right = r.compare_indicator ? String(r.compare_indicator).toUpperCase() : r.value;
          return (
            <Chip
              key={`${r.indicator}_${r.condition}_${idx}`}
              color="secondary"
              variant="outlined"
              label={`${idx + 1}. ${String(r.indicator).toUpperCase()} ${String(r.condition).toUpperCase()} ${right}`}
              onDelete={() => removeRule(idx)}
            />
          );
        })}
        {rules.length === 0 ? (
          <Chip color="default" variant="outlined" label={`Draft: ${draftRuleLabel}`} />
        ) : null}
      </Box>

      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Scanned: {meta.scan_symbols} | Universe: {universe === 'all' ? 'All Symbols' : 'Watchlist'} | Cache: {meta.cached ? 'hit' : 'fresh'} | Rule mode: AND ({effectiveRules.length} rule{effectiveRules.length > 1 ? 's' : ''})
      </Typography>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      {loading ? (
        <Box sx={{ py: 5, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      ) : null}

      {!loading && rows.length === 0 ? (
        <Alert severity="info">No symbols matched this indicator condition right now.</Alert>
      ) : null}

      {!loading && rows.length > 0 ? (
        <TableContainer sx={{ overflowX: 'auto', borderRadius: 2, border: '1px solid rgba(255,255,255,0.12)' }}>
          <Table size="small" sx={{ minWidth: 1350 }}>
            <TableHead>
              <TableRow>
                <TableCell onClick={() => handleSort('symbol')} sx={{ cursor: 'pointer' }}>Symbol{getSortArrow('symbol')}</TableCell>
                <TableCell onClick={() => handleSort('rule')} sx={{ cursor: 'pointer' }}>Rule{getSortArrow('rule')}</TableCell>
                <TableCell onClick={() => handleSort('matched')} sx={{ cursor: 'pointer' }}>Matched Rules (AND){getSortArrow('matched')}</TableCell>
                <TableCell align="right" onClick={() => handleSort('current')} sx={{ cursor: 'pointer' }}>Current{getSortArrow('current')}</TableCell>
                <TableCell align="right" onClick={() => handleSort('prev')} sx={{ cursor: 'pointer' }}>{prevLabel}{getSortArrow('prev')}</TableCell>
                <TableCell align="right" onClick={() => handleSort('rhs')} sx={{ cursor: 'pointer' }}>{cmpLabel}{getSortArrow('rhs')}</TableCell>
                <TableCell align="right" onClick={() => handleSort('rsi')} sx={{ cursor: 'pointer' }}>RSI{getSortArrow('rsi')}</TableCell>
                <TableCell align="right" onClick={() => handleSort('macd')} sx={{ cursor: 'pointer' }}>MACD{getSortArrow('macd')}</TableCell>
                <TableCell align="right" onClick={() => handleSort('signal')} sx={{ cursor: 'pointer' }}>Signal{getSortArrow('signal')}</TableCell>
                <TableCell align="right" onClick={() => handleSort('hist')} sx={{ cursor: 'pointer' }}>Hist{getSortArrow('hist')}</TableCell>
                <TableCell align="right" onClick={() => handleSort('relVol')} sx={{ cursor: 'pointer' }}>Rel Vol{getSortArrow('relVol')}</TableCell>
                <TableCell align="right" onClick={() => handleSort('rs')} sx={{ cursor: 'pointer' }}>RS{getSortArrow('rs')}</TableCell>
                <TableCell align="right" onClick={() => handleSort('score')} sx={{ cursor: 'pointer' }}>Score{getSortArrow('score')}</TableCell>
                <TableCell onClick={() => handleSort('trend')} sx={{ cursor: 'pointer' }}>Trend{getSortArrow('trend')}</TableCell>
                <TableCell onClick={() => handleSort('date')} sx={{ cursor: 'pointer' }}>Date{getSortArrow('date')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedRows.map((r) => {
                const isBull = String(r?.trend || '').toLowerCase() === 'bullish';
                const bg = isBull ? 'rgba(76, 175, 80, 0.12)' : 'rgba(244, 67, 54, 0.12)';
                return (
                  <TableRow key={`${r.symbol}_${r.signal_date}_${r.condition}`} sx={{ backgroundColor: bg }}>
                    <TableCell sx={{ fontWeight: 700 }}>{r.symbol}</TableCell>
                    <TableCell>{r.rule_text}</TableCell>
                    <TableCell>{Array.isArray(r.matched_rules) ? r.matched_rules.length : '—'}</TableCell>
                    <TableCell align="right">{fmt(r.current_value, 3)}</TableCell>
                    <TableCell align="right">{fmt(r.previous_value, 3)}</TableCell>
                    <TableCell align="right">
                      {fmt(r.current_compare_value ?? (r?.matched_rules?.[0]?.value ?? null), 3)}
                    </TableCell>
                    <TableCell align="right">{fmt(r.rsi, 2)}</TableCell>
                    <TableCell align="right">{fmt(r.macd, 4)}</TableCell>
                    <TableCell align="right">{fmt(r.macd_signal, 4)}</TableCell>
                    <TableCell align="right">{fmt(r.macd_histogram, 4)}</TableCell>
                    <TableCell align="right">{fmt(r.volume_ratio, 2)}</TableCell>
                    <TableCell align="right">{fmt(r.relative_strength, 2)}</TableCell>
                    <TableCell align="right">{fmt(r.signal_score, 2)}</TableCell>
                    <TableCell>{r.trend || '—'}</TableCell>
                    <TableCell>{r.signal_date || '—'}</TableCell>
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

export default LiveScreenerPage;
