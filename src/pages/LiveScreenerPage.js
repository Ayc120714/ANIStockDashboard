import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
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
import { fetchAgentSupervisorSignals, fetchIndicatorScreenerMultiSignals } from '../api/advisor';
import { addToWatchlist } from '../api/watchlist';

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

const AGENT_OPTIONS = [
  { name: 'rsi_agent', label: 'RSI' },
  { name: 'macd_agent', label: 'MACD' },
  { name: 'sqz_agent', label: 'SQZ' },
  { name: 'ema200_agent', label: 'EMA200' },
  { name: 'ema21_agent', label: 'EMA21' },
  { name: 'ema5_agent', label: 'EMA5' },
];

const EMPTY_AGENT_FILTERS = AGENT_OPTIONS.reduce((acc, item) => {
  acc[item.name] = 'any';
  return acc;
}, {});

function LiveScreenerPage() {
  const [screenerMode, setScreenerMode] = useState('indicator');
  const [timeframe, setTimeframe] = useState('monthly');
  const [universe, setUniverse] = useState('all');
  const [supervisorSide, setSupervisorSide] = useState('all');
  const [minConfidence, setMinConfidence] = useState(55);
  const [agentFilters, setAgentFilters] = useState(EMPTY_AGENT_FILTERS);
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
  const [selectedSymbols, setSelectedSymbols] = useState(new Set());
  const [addingTarget, setAddingTarget] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');

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
      const payload = screenerMode === 'agent'
        ? await fetchAgentSupervisorSignals({
          timeframe,
          universe,
          symbols: symbolsInput,
          side: supervisorSide,
          minConfidence,
          limit: 250,
        })
        : await fetchIndicatorScreenerMultiSignals({
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
  }, [screenerMode, timeframe, universe, effectiveRules, symbolsInput, supervisorSide, minConfidence]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const id = setInterval(() => load(), 60000);
    return () => clearInterval(id);
  }, [autoRefresh, load]);

  useEffect(() => {
    if (screenerMode !== 'agent' && ['5m', '15m', '1h'].includes(timeframe)) {
      setTimeframe('daily');
    }
  }, [screenerMode, timeframe]);

  useEffect(() => {
    setSortConfig(screenerMode === 'agent'
      ? { key: 'confidence', ascending: false }
      : { key: 'score', ascending: false });
  }, [screenerMode]);

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

  const title = screenerMode === 'agent'
    ? `Live Agent Supervisor (${meta.count})`
    : `Live Indicator Screener (${meta.count})`;
  const prevLabel = timeframe === 'monthly'
    ? '1M Ago'
    : timeframe === 'weekly'
      ? '1W Ago'
      : timeframe === 'daily'
        ? 'Prev Day'
        : 'Prev Bar';
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

  const supervisorFilteredRows = useMemo(() => {
    if (screenerMode !== 'agent') return rows;
    return rows.filter((row) => {
      const bucket = Array.isArray(row?.agents) ? row.agents : [];
      return Object.entries(agentFilters).every(([agentName, desired]) => {
        if (!desired || desired === 'any') return true;
        const item = bucket.find((a) => String(a?.name) === agentName);
        return String(item?.state || '').toLowerCase() === String(desired).toLowerCase();
      });
    });
  }, [screenerMode, rows, agentFilters]);

  const sortedRows = useMemo(() => {
    const sourceRows = screenerMode === 'agent' ? supervisorFilteredRows : rows;
    const getVal = (row, key) => {
      if (screenerMode === 'agent') {
        switch (key) {
          case 'symbol': return String(row?.symbol || '');
          case 'direction': return String(row?.direction || '');
          case 'signal_type': return String(row?.signal_type || '');
          case 'confidence': return Number(row?.confidence ?? Number.NEGATIVE_INFINITY);
          case 'score': return Number(row?.composite_score ?? Number.NEGATIVE_INFINITY);
          case 'rsi': return Number((row?.agents || []).find((a) => a.name === 'rsi_agent')?.details?.rsi ?? Number.NEGATIVE_INFINITY);
          case 'macd': return Number((row?.agents || []).find((a) => a.name === 'macd_agent')?.details?.macd ?? Number.NEGATIVE_INFINITY);
          case 'sqz': return Number((row?.agents || []).find((a) => a.name === 'sqz_agent')?.details?.sqz_value ?? Number.NEGATIVE_INFINITY);
          case 'close': return Number(row?.close ?? Number.NEGATIVE_INFINITY);
          case 'date': return String(row?.as_of || '');
          default: return '';
        }
      }
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

    const data = [...sourceRows];
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
  }, [rows, supervisorFilteredRows, screenerMode, sortConfig]);

  const visibleSymbols = useMemo(
    () => Array.from(new Set(sortedRows.map((r) => String(r?.symbol || '').toUpperCase()).filter(Boolean))),
    [sortedRows]
  );

  useEffect(() => {
    setSelectedSymbols((prev) => {
      const next = new Set();
      visibleSymbols.forEach((sym) => {
        if (prev.has(sym)) next.add(sym);
      });
      return next;
    });
  }, [visibleSymbols]);

  const toggleSelectSymbol = useCallback((symbol) => {
    const sym = String(symbol || '').toUpperCase();
    if (!sym) return;
    setSelectedSymbols((prev) => {
      const next = new Set(prev);
      if (next.has(sym)) next.delete(sym);
      else next.add(sym);
      return next;
    });
  }, []);

  const toggleSelectAllVisible = useCallback(() => {
    const allSelected = visibleSymbols.length > 0 && visibleSymbols.every((sym) => selectedSymbols.has(sym));
    setSelectedSymbols((prev) => {
      const next = new Set(prev);
      if (allSelected) visibleSymbols.forEach((sym) => next.delete(sym));
      else visibleSymbols.forEach((sym) => next.add(sym));
      return next;
    });
  }, [visibleSymbols, selectedSymbols]);

  const handleAddSelectedTo = useCallback(async (listType) => {
    const symbols = Array.from(selectedSymbols);
    if (!symbols.length) return;
    setAddingTarget(listType);
    setActionError('');
    setActionMessage('');
    const jobs = symbols.map((sym) => addToWatchlist(sym, listType, 'added from live screener'));
    const results = await Promise.allSettled(jobs);
    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    const failCount = results.length - successCount;
    if (successCount > 0) {
      setActionMessage(`${successCount} stock(s) added to ${listType === 'short_term' ? 'Short Term' : 'Long Term'} watchlist.`);
    }
    if (failCount > 0) {
      setActionError(`${failCount} stock(s) were skipped (already added or failed).`);
    }
    setAddingTarget('');
  }, [selectedSymbols]);

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>{title}</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
        {screenerMode === 'agent'
          ? 'Live multi-agent supervisor with AND filters by indicator agent state.'
          : 'Build multiple indicator rules and scan with AND condition (all rules must match).'}
      </Typography>

      {screenerMode !== 'agent' ? (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
          {presets.map((preset) => (
            <Chip key={preset.key} label={preset.label} onClick={preset.apply} clickable color="primary" variant="outlined" />
          ))}
        </Box>
      ) : null}

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
          label="Mode"
          value={screenerMode}
          onChange={(e) => setScreenerMode(e.target.value)}
          sx={{ minWidth: 170 }}
        >
          <MenuItem value="indicator">Indicator Rules (AND)</MenuItem>
          <MenuItem value="agent">Agent Supervisor (Live)</MenuItem>
        </TextField>
        <TextField select size="small" label="Timeframe" value={timeframe} onChange={(e) => setTimeframe(e.target.value)} sx={{ minWidth: 140 }}>
          <MenuItem value="daily">Daily</MenuItem>
          <MenuItem value="weekly">Weekly</MenuItem>
          <MenuItem value="monthly">Monthly</MenuItem>
          {screenerMode === 'agent' ? <MenuItem value="5m">5 Minutes</MenuItem> : null}
          {screenerMode === 'agent' ? <MenuItem value="15m">15 Minutes</MenuItem> : null}
          {screenerMode === 'agent' ? <MenuItem value="1h">1 Hour</MenuItem> : null}
        </TextField>
        <TextField select size="small" label="Universe" value={universe} onChange={(e) => setUniverse(e.target.value)} sx={{ minWidth: 140 }}>
          <MenuItem value="all">All Symbols</MenuItem>
          <MenuItem value="watchlist">Watchlist</MenuItem>
        </TextField>
        {screenerMode === 'agent' ? (
          <>
            <TextField
              select
              size="small"
              label="Signal Side"
              value={supervisorSide}
              onChange={(e) => setSupervisorSide(e.target.value)}
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="bullish">Bullish</MenuItem>
              <MenuItem value="bearish">Bearish</MenuItem>
            </TextField>
            <TextField
              size="small"
              type="number"
              label="Min Confidence"
              value={minConfidence}
              onChange={(e) => setMinConfidence(Math.max(0, Math.min(100, Number(e.target.value || 0))))}
              sx={{ width: 145 }}
            />
          </>
        ) : (
          <>
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
          </>
        )}
        <TextField
          size="small"
          label="Symbols (optional CSV)"
          value={symbolsInput}
          onChange={(e) => setSymbolsInput(e.target.value)}
          sx={{ minWidth: 260, background: '#fff' }}
        />
        <FormControlLabel control={<Switch checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />} label="Auto 60s" />
        <Button variant="outlined" onClick={() => load()} disabled={loading}>Scan</Button>
        {screenerMode !== 'agent' ? (
          <Button variant="contained" color="success" onClick={() => load({ sendTelegram: true })} disabled={loading}>
            Send Telegram
          </Button>
        ) : null}
      </Box>

      {screenerMode !== 'agent' ? (
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
      ) : (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
          {AGENT_OPTIONS.map((a) => (
            <TextField
              key={a.name}
              select
              size="small"
              label={`${a.label} Filter`}
              value={agentFilters[a.name] || 'any'}
              onChange={(e) => setAgentFilters((prev) => ({ ...prev, [a.name]: e.target.value }))}
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="any">Any</MenuItem>
              <MenuItem value="bullish">Bullish</MenuItem>
              <MenuItem value="bearish">Bearish</MenuItem>
              <MenuItem value="neutral">Neutral</MenuItem>
            </TextField>
          ))}
        </Box>
      )}

      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        {screenerMode === 'agent'
          ? `Scanned: ${meta.scan_symbols} | Universe: ${universe === 'all' ? 'All Symbols' : 'Watchlist'} | Mode: Agent Supervisor | Filtered Rows: ${sortedRows.length}`
          : `Scanned: ${meta.scan_symbols} | Universe: ${universe === 'all' ? 'All Symbols' : 'Watchlist'} | Cache: ${meta.cached ? 'hit' : 'fresh'} | Rule mode: AND (${effectiveRules.length} rule${effectiveRules.length > 1 ? 's' : ''})`}
      </Typography>

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 1.5 }}>
        <Chip label={`${selectedSymbols.size} selected`} size="small" />
        <Button
          size="small"
          variant="outlined"
          onClick={() => handleAddSelectedTo('short_term')}
          disabled={!selectedSymbols.size || addingTarget === 'short_term'}
        >
          {addingTarget === 'short_term' ? 'Adding...' : 'Add Selected to ST'}
        </Button>
        <Button
          size="small"
          variant="outlined"
          onClick={() => handleAddSelectedTo('long_term')}
          disabled={!selectedSymbols.size || addingTarget === 'long_term'}
        >
          {addingTarget === 'long_term' ? 'Adding...' : 'Add Selected to LT'}
        </Button>
      </Box>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      {actionError ? <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setActionError('')}>{actionError}</Alert> : null}
      {actionMessage ? <Alert severity="success" sx={{ mb: 2 }} onClose={() => setActionMessage('')}>{actionMessage}</Alert> : null}
      {loading ? (
        <Box sx={{ py: 5, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      ) : null}

      {!loading && rows.length === 0 ? (
        <Alert severity="info">
          {screenerMode === 'agent'
            ? 'No symbols matched the supervisor filters right now.'
            : 'No symbols matched this indicator condition right now.'}
        </Alert>
      ) : null}

      {!loading && rows.length > 0 ? (
        screenerMode === 'agent' ? (
          <TableContainer sx={{ overflowX: 'auto', borderRadius: 2, border: '1px solid rgba(255,255,255,0.12)' }}>
            <Table size="small" sx={{ minWidth: 1400 }}>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      size="small"
                      checked={visibleSymbols.length > 0 && visibleSymbols.every((sym) => selectedSymbols.has(sym))}
                      indeterminate={visibleSymbols.some((sym) => selectedSymbols.has(sym)) && !visibleSymbols.every((sym) => selectedSymbols.has(sym))}
                      onChange={toggleSelectAllVisible}
                    />
                  </TableCell>
                  <TableCell onClick={() => handleSort('symbol')} sx={{ cursor: 'pointer' }}>Symbol{getSortArrow('symbol')}</TableCell>
                  <TableCell onClick={() => handleSort('signal_type')} sx={{ cursor: 'pointer' }}>Signal{getSortArrow('signal_type')}</TableCell>
                  <TableCell onClick={() => handleSort('direction')} sx={{ cursor: 'pointer' }}>Direction{getSortArrow('direction')}</TableCell>
                  <TableCell align="right" onClick={() => handleSort('confidence')} sx={{ cursor: 'pointer' }}>Confidence{getSortArrow('confidence')}</TableCell>
                  <TableCell align="right" onClick={() => handleSort('score')} sx={{ cursor: 'pointer' }}>Composite Score{getSortArrow('score')}</TableCell>
                  <TableCell align="right" onClick={() => handleSort('close')} sx={{ cursor: 'pointer' }}>CMP{getSortArrow('close')}</TableCell>
                  <TableCell onClick={() => handleSort('rsi')} sx={{ cursor: 'pointer' }}>RSI Agent{getSortArrow('rsi')}</TableCell>
                  <TableCell onClick={() => handleSort('macd')} sx={{ cursor: 'pointer' }}>MACD Agent{getSortArrow('macd')}</TableCell>
                  <TableCell onClick={() => handleSort('sqz')} sx={{ cursor: 'pointer' }}>SQZ Agent{getSortArrow('sqz')}</TableCell>
                  <TableCell>Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedRows.map((r) => {
                  const direction = String(r?.direction || 'neutral').toLowerCase();
                  const bg = direction === 'bullish' ? 'rgba(76, 175, 80, 0.12)' : direction === 'bearish' ? 'rgba(244, 67, 54, 0.12)' : 'rgba(120, 144, 156, 0.12)';
                  const agents = Array.isArray(r?.agents) ? r.agents : [];
                  const rsiA = agents.find((a) => a.name === 'rsi_agent');
                  const macdA = agents.find((a) => a.name === 'macd_agent');
                  const sqzA = agents.find((a) => a.name === 'sqz_agent');
                  return (
                    <TableRow key={`${r.symbol}_${r.as_of}`} sx={{ backgroundColor: bg }}>
                      <TableCell padding="checkbox">
                        <Checkbox
                          size="small"
                          checked={selectedSymbols.has(String(r.symbol || '').toUpperCase())}
                          onChange={() => toggleSelectSymbol(r.symbol)}
                        />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{r.symbol}</TableCell>
                      <TableCell>{String(r.signal_type || 'hold').toUpperCase()}</TableCell>
                      <TableCell>{String(r.direction || 'neutral').toUpperCase()}</TableCell>
                      <TableCell align="right">{fmt(r.confidence, 1)}%</TableCell>
                      <TableCell align="right">{fmt(r.composite_score, 2)}</TableCell>
                      <TableCell align="right">{fmt(r.close, 2)}</TableCell>
                      <TableCell>{`${String(rsiA?.state || 'neutral').toUpperCase()} (${fmt(rsiA?.details?.rsi, 1)})`}</TableCell>
                      <TableCell>{`${String(macdA?.state || 'neutral').toUpperCase()} (${fmt(macdA?.details?.macd, 3)})`}</TableCell>
                      <TableCell>{`${String(sqzA?.state || 'neutral').toUpperCase()} (${fmt(sqzA?.details?.sqz_value, 3)})`}</TableCell>
                      <TableCell>{r.as_of || '—'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <TableContainer sx={{ overflowX: 'auto', borderRadius: 2, border: '1px solid rgba(255,255,255,0.12)' }}>
            <Table size="small" sx={{ minWidth: 1350 }}>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      size="small"
                      checked={visibleSymbols.length > 0 && visibleSymbols.every((sym) => selectedSymbols.has(sym))}
                      indeterminate={visibleSymbols.some((sym) => selectedSymbols.has(sym)) && !visibleSymbols.every((sym) => selectedSymbols.has(sym))}
                      onChange={toggleSelectAllVisible}
                    />
                  </TableCell>
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
                      <TableCell padding="checkbox">
                        <Checkbox
                          size="small"
                          checked={selectedSymbols.has(String(r.symbol || '').toUpperCase())}
                          onChange={() => toggleSelectSymbol(r.symbol)}
                        />
                      </TableCell>
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
        )
      ) : null}
    </Box>
  );
}

export default LiveScreenerPage;
