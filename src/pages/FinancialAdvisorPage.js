import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { TableSection, TableTitle, TableWrapper, Table } from './SectorOutlook.styles';
import { Box, TextField, Button, Chip, CircularProgress, Tabs, Tab, Select, MenuItem, Autocomplete, Tooltip, Checkbox } from '@mui/material';
import Pagination from '@mui/material/Pagination';
import { MdCheck, MdContentCopy, MdSelectAll } from 'react-icons/md';
import { FaSortUp, FaSortDown, FaSort } from 'react-icons/fa';
import { fetchLatestSignalsPayload, fetchMonthlyMacdSetup, fetchAlerts, markAlertRead, triggerAnalysis, fetchAnalysis, fetchPortfolioHealth, compareStocks, refreshAdvisor } from '../api/advisor';
import { addToWatchlist } from '../api/watchlist';
import { apiGet } from '../api/apiClient';

const trendColors = { bullish: '#1b5e20', bearish: '#c62828', sideways: '#f57f17' };
const fmt = (v) => {
  if (v == null || v === '' || isNaN(v)) return '—';
  return `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const compact = { fontSize: 12, padding: '4px 6px', whiteSpace: 'nowrap' };
const parseNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

function useSymbolList() {
  const [allSymbols, setAllSymbols] = useState([]);
  const load = useCallback(() => {
    apiGet('/watchlist/available-symbols')
      .then(res => setAllSymbols(res?.data ?? []))
      .catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);
  return allSymbols;
}

function trendLabel(trend, recommendation) {
  const t = (trend || 'sideways').charAt(0).toUpperCase() + (trend || 'sideways').slice(1);
  const r = (recommendation || '').replace(/_/g, ' ');
  const short = r ? r.charAt(0).toUpperCase() + r.slice(1) : '';
  return short ? `${t} (${short})` : t;
}

function normalizeReco(value) {
  const v = String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
  if (v === 'strongbuy') return 'strong_buy';
  if (v === 'strongsell') return 'strong_sell';
  return v;
}

function deriveStrategyTags(row) {
  const tags = [];
  if (row?.monthly_setup_rule || row?.monthly_psar_macd_rule || row?.monthly_qualified) {
    tags.push({ label: 'Monthly MACD+PSAR', tone: 'bull' });
  }
  if (row?.vwap_cross_quarter_above) {
    tags.push({ label: 'VWAP > QVWAP Cross', tone: 'bull' });
  }
  if (row?.vwap_cross_quarter_below) {
    tags.push({ label: 'VWAP < QVWAP Cross', tone: 'bear' });
  }
  return tags;
}

function dedupeSignalsBySymbol(rows) {
  const bySymbol = new Map();
  for (const row of rows || []) {
    const symbol = String(row?.symbol || '').toUpperCase();
    if (!symbol) continue;
    const prev = bySymbol.get(symbol);
    if (!prev) {
      bySymbol.set(symbol, row);
      continue;
    }
    const prevScore = Number(prev.conviction_score ?? prev.signal_score ?? Number.NEGATIVE_INFINITY);
    const curScore = Number(row.conviction_score ?? row.signal_score ?? Number.NEGATIVE_INFINITY);
    if (curScore > prevScore) {
      bySymbol.set(symbol, row);
    }
  }
  return Array.from(bySymbol.values());
}

function getTrailingState(row) {
  const cmp = parseNumber(row?.cmp ?? row?.price);
  const entry = parseNumber(row?.entry_price);
  const stopLoss = parseNumber(row?.stop_loss);
  const t1 = parseNumber(row?.target_1 ?? row?.target_short_term ?? row?.target_long_term);
  if (cmp == null || entry == null || stopLoss == null || t1 == null) {
    return { t1Hit: false, costExit: false, effectiveStopLoss: stopLoss };
  }
  const t1Hit = cmp >= t1;
  const effectiveStopLoss = t1Hit ? entry : stopLoss;
  const costExit = t1Hit && cmp <= entry;
  return { t1Hit, costExit, effectiveStopLoss };
}

function FinancialAdvisorPage() {
  const [tab, setTab] = useState(0);

  useEffect(() => {
    apiGet('/system/status')
      .then(() => {})
      .catch(() => {});
  }, []);

  return (
    <TableSection>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <TableTitle style={{ margin: 0 }}>Financial Advisor</TableTitle>
        <Button size="small" variant="outlined" onClick={() => refreshAdvisor()} sx={{ textTransform: 'none', ml: 'auto' }}>
          Refresh All
        </Button>
      </Box>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto"
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tab label="Signals & Alerts" />
        <Tab label="AI Analysis" />
        <Tab label="Portfolio Health" />
      </Tabs>
      {tab === 0 && <SignalsAlertsTab />}
      {tab === 1 && <AnalysisTab />}
      {tab === 2 && <PortfolioTab />}
    </TableSection>
  );
}

const SIG_COLS = [
  { key: 'symbol', label: 'Symbol' },
  { key: 'conviction_score', label: 'Conv', numeric: true },
  { key: 'status', label: 'Status' },
  { key: 'buy_sell_tier', label: 'Tier' },
  { key: 'trend', label: 'Trend' },
  { key: 'strategies', label: 'Strategies' },
  { key: 'weekly_trend', label: 'Wk Trend' },
  { key: 'cmp', label: 'CMP', numeric: true },
  { key: 'entry_price', label: 'Entry', numeric: true },
  { key: 'stop_loss', label: 'SL', numeric: true },
  { key: 'sl_pct', label: 'SL%', numeric: true },
  { key: 'target_1', label: 'T1', numeric: true },
  { key: 'target_2', label: 'T2', numeric: true },
  { key: 'next_scope_target', label: 'Scope', numeric: true },
  { key: 'sector', label: 'Sector' },
];

const ALERT_COLS = [
  { key: 'timestamp', label: 'Time' },
  { key: 'symbol', label: 'Symbol' },
  { key: 'entry_price', label: 'Entry', numeric: true },
  { key: 'stop_loss', label: 'SL', numeric: true },
  { key: 'target_1', label: 'T1', numeric: true },
  { key: 'target_2', label: 'T2', numeric: true },
  { key: 'signal_score', label: 'Score', numeric: true },
  { key: '_read', label: '' },
];

function SignalsAlertsTab() {
  const [view, setView] = useState('signals');
  const [signalData, setSignalData] = useState([]);
  const [signalPayload, setSignalPayload] = useState(null);
  const [monthlySetupData, setMonthlySetupData] = useState([]);
  const [alertData, setAlertData] = useState([]);
  const [signalsLoading, setSignalsLoading] = useState(true);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [sourceFilter, setSourceFilter] = useState('');
  const [symbolFilter, setSymbolFilter] = useState('');
  const [page, setPage] = useState(1);
  const [added, setAdded] = useState({});
  const [sortCol, setSortCol] = useState('conviction_score');
  const [sortDir, setSortDir] = useState('desc');
  const [convFilters, setConvFilters] = useState([]);
  const [recoFilter, setRecoFilter] = useState('all');
  const [strategyFilter, setStrategyFilter] = useState('all');
  const [copied, setCopied] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [checkedSymbols, setCheckedSymbols] = useState(new Set());
  const rowsPerPage = showAll ? 9999 : 25;
  const [monthlyLoading, setMonthlyLoading] = useState(false);

  const handleSort = (col) => {
    if (col === '_actions' || col === '_read') return;
    if (sortCol === col) {
      if (sortDir === 'desc') setSortDir('asc');
      else { setSortCol(''); setSortDir('desc'); }
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
    setPage(1);
  };

  const SortIcon = ({ col }) => {
    if (col === '_actions' || col === '_read') return null;
    if (sortCol !== col) return <FaSort style={{ opacity: 0.3, marginLeft: 3, fontSize: 10 }} />;
    return sortDir === 'asc'
      ? <FaSortUp style={{ color: '#fff', marginLeft: 3, fontSize: 10 }} />
      : <FaSortDown style={{ color: '#fff', marginLeft: 3, fontSize: 10 }} />;
  };

  const loadMonthlySetup = useCallback(() => {
    const monthlyCacheKey = 'advisor_monthly_setup_v1';
    setMonthlyLoading(true);
    return fetchMonthlyMacdSetup(300)
      .then((rows) => {
        setMonthlySetupData(rows);
        try { sessionStorage.setItem(monthlyCacheKey, JSON.stringify(rows || [])); } catch (_) {}
      })
      .catch(() => {})
      .finally(() => setMonthlyLoading(false));
  }, []);

  const loadSignals = useCallback(() => {
    const cacheKey = 'advisor_signals_payload_v1';
    const monthlyCacheKey = 'advisor_monthly_setup_v1';
    let hasCachedSignals = false;
    try {
      const cachedPayload = sessionStorage.getItem(cacheKey);
      if (cachedPayload) {
        const parsed = JSON.parse(cachedPayload);
        setSignalPayload(parsed || null);
        setSignalData(parsed?.data || []);
        hasCachedSignals = true;
        setSignalsLoading(false);
      }
      const cachedMonthly = sessionStorage.getItem(monthlyCacheKey);
      if (cachedMonthly) {
        const parsedMonthly = JSON.parse(cachedMonthly);
        if (Array.isArray(parsedMonthly)) setMonthlySetupData(parsedMonthly);
      }
    } catch (_) {}

    if (!hasCachedSignals) setSignalsLoading(true);
    fetchLatestSignalsPayload(250).then((payload) => {
      setSignalPayload(payload || null);
      setSignalData(payload?.data || []);
      try { sessionStorage.setItem(cacheKey, JSON.stringify(payload || null)); } catch (_) {}
    }).catch(() => {}).finally(() => setSignalsLoading(false));

    // Keep monthly strategy refresh non-blocking for first paint.
    setTimeout(() => {
      loadMonthlySetup();
    }, 0);
  }, [loadMonthlySetup]);

  const loadAlerts = useCallback(() => {
    setAlertsLoading(true);
    return fetchAlerts({
      limit: 200,
      ...(sourceFilter ? { source: sourceFilter } : {}),
      ...(symbolFilter ? { symbol: symbolFilter } : {}),
    })
      .then(setAlertData)
      .catch(() => {})
      .finally(() => setAlertsLoading(false));
  }, [sourceFilter, symbolFilter]);

  useEffect(() => {
    loadSignals();
  }, [loadSignals]);

  useEffect(() => {
    if (view !== 'alerts') return;
    loadAlerts();
  }, [view, loadAlerts]);

  useEffect(() => {
    if (!convFilters.includes('monthly_setup')) return;
    if (monthlySetupData.length > 0 || monthlyLoading) return;
    loadMonthlySetup();
  }, [convFilters, monthlySetupData.length, monthlyLoading, loadMonthlySetup]);

  const filteredSignals = useMemo(() => {
    const activeFilters = convFilters.filter((f) => f && f !== 'all');
    const hasMonthlyFilter = activeFilters.includes('monthly_setup');
    const hasDoneFilter = activeFilters.includes('done');
    let rows = hasMonthlyFilter
      ? dedupeSignalsBySymbol([...(signalData || []), ...(monthlySetupData || [])])
      : signalData;
    rows = rows.filter((s) => {
      if (!hasMonthlyFilter && !(s.cmp && s.entry_price)) return false;
      return hasDoneFilter ? true : !s.hit_target;
    });
    if (symbolFilter) {
      const q = symbolFilter.toUpperCase();
      rows = rows.filter(s => s.symbol?.includes(q));
    }
    activeFilters.forEach((filterKey) => {
      if (filterKey === 'high') {
        rows = rows.filter(s => s.high_conviction);
      } else if (filterKey === 'high_bull') {
        rows = rows.filter(s => s.high_conviction && String(s.trend || '').toLowerCase() === 'bullish');
      } else if (filterKey === 'high_bear') {
        rows = rows.filter(s => s.high_conviction && String(s.trend || '').toLowerCase() === 'bearish');
      } else if (filterKey === 'weekly') {
        rows = rows.filter(s => s.weekly_aligned);
      } else if (filterKey === 'actionable') {
        rows = rows.filter(s => s.actionable);
      } else if (filterKey === 'entry_ready') {
        rows = rows.filter(s => s.status === 'entry_ready');
      } else if (filterKey === 'done') {
        rows = rows.filter(s => s.target_done || s.status === 'done');
      } else if (filterKey === 'monthly_setup') {
        rows = rows.filter(s => s.monthly_setup_rule || s.monthly_psar_macd_rule || s.monthly_qualified);
      }
    });
    if (recoFilter !== 'all') {
      rows = rows.filter(s => {
        const rec = normalizeReco(s.signal_type || s.recommendation);
        return rec === recoFilter;
      });
    }
    if (strategyFilter === 'monthly_psar_macd') {
      rows = rows.filter(s => s.monthly_setup_rule || s.monthly_psar_macd_rule || s.monthly_qualified);
    } else if (strategyFilter === 'vwap_cross_above') {
      rows = rows.filter(s => s.vwap_cross_quarter_above);
    } else if (strategyFilter === 'vwap_cross_below') {
      rows = rows.filter(s => s.vwap_cross_quarter_below);
    }
    return dedupeSignalsBySymbol(rows);
  }, [signalData, monthlySetupData, symbolFilter, convFilters, recoFilter, strategyFilter]);

  const uniqueSignalData = useMemo(
    () => dedupeSignalsBySymbol(signalData.filter(s => s.cmp && s.entry_price)),
    [signalData]
  );
  const highConvCount = uniqueSignalData.filter(s => s.high_conviction).length;
  const highConvBullCount = uniqueSignalData.filter(s => s.high_conviction && String(s.trend || '').toLowerCase() === 'bullish').length;
  const highConvBearCount = uniqueSignalData.filter(s => s.high_conviction && String(s.trend || '').toLowerCase() === 'bearish').length;
  const weeklyAlignedCount = uniqueSignalData.filter(s => s.weekly_aligned).length;
  const actionableCount = uniqueSignalData.filter(s => s.actionable).length;
  const doneCount = uniqueSignalData.filter(s => s.target_done || s.status === 'done').length;
  const entryReadyCount = uniqueSignalData.filter(s => s.status === 'entry_ready').length;
  const monthlySetupCount = useMemo(() => dedupeSignalsBySymbol(monthlySetupData).length, [monthlySetupData]);

  const sortedData = useMemo(() => {
    const src = view === 'signals' ? filteredSignals : alertData;
    if (!sortCol) return src;
    const cols = view === 'signals' ? SIG_COLS : ALERT_COLS;
    const colDef = cols.find(c => c.key === sortCol);
    const isNum = colDef?.numeric;
    return [...src].sort((a, b) => {
      let va = a[sortCol], vb = b[sortCol];
      if (va == null) va = isNum ? -Infinity : '';
      if (vb == null) vb = isNum ? -Infinity : '';
      if (isNum) {
        va = Number(va) || -Infinity;
        vb = Number(vb) || -Infinity;
      } else {
        va = String(va).toLowerCase();
        vb = String(vb).toLowerCase();
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [view, filteredSignals, alertData, sortCol, sortDir]);

  const totalPages = Math.ceil(sortedData.length / rowsPerPage);
  const paged = sortedData.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  const handleAdd = async (symbol, listType) => {
    const key = `${symbol}_${listType}`;
    if (added[key]) return;
    try {
      await addToWatchlist(symbol.toUpperCase(), listType, '');
      setAdded(prev => ({ ...prev, [key]: true }));
    } catch (_) { /* ignore */ }
  };

  const handleAddSelected = async (listType) => {
    const syms = [...checkedSymbols].filter(Boolean);
    if (!syms.length) return;
    for (const symbol of syms) {
      // Reuse single-add flow so existing dedupe/disable state stays consistent.
      // eslint-disable-next-line no-await-in-loop
      await handleAdd(symbol, listType);
    }
  };

  const handleMarkRead = async (id) => {
    await markAlertRead(id);
    if (view === 'alerts') {
      loadAlerts();
    }
  };

  return (
    <>
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', border: '1px solid #ccc', borderRadius: 1, overflow: 'hidden' }}>
          {['signals', 'alerts'].map(v => (
            <Button key={v} size="small" onClick={() => { setView(v); setPage(1); }}
              sx={{ textTransform: 'none', px: 2, borderRadius: 0, fontSize: 12, fontWeight: view === v ? 700 : 400,
                bgcolor: view === v ? '#1a3c5e' : 'transparent', color: view === v ? '#fff' : '#333',
                '&:hover': { bgcolor: view === v ? '#1a3c5e' : '#f5f5f5' } }}>
              {v === 'signals' ? `Signals (${filteredSignals.length})` : `Alerts (${alertData.length})`}
            </Button>
          ))}
        </Box>
        {view === 'signals' && (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <Select
              size="small"
              value={recoFilter}
              onChange={e => { setRecoFilter(e.target.value); setPage(1); }}
              sx={{ minWidth: 150, fontSize: 12 }}
            >
              <MenuItem value="all">All Reco</MenuItem>
              <MenuItem value="strong_buy">Strong Buy</MenuItem>
              <MenuItem value="buy">Buy</MenuItem>
              <MenuItem value="hold">Hold</MenuItem>
              <MenuItem value="sell">Sell</MenuItem>
              <MenuItem value="strong_sell">Strong Sell</MenuItem>
            </Select>
            <Select
              size="small"
              value={strategyFilter}
              onChange={e => { setStrategyFilter(e.target.value); setPage(1); }}
              sx={{ minWidth: 180, fontSize: 12 }}
            >
              <MenuItem value="all">All Strategies</MenuItem>
              <MenuItem value="monthly_psar_macd">Monthly MACD+PSAR</MenuItem>
              <MenuItem value="vwap_cross_above">VWAP Cross Above</MenuItem>
              <MenuItem value="vwap_cross_below">VWAP Cross Below</MenuItem>
            </Select>
            <Box sx={{ display: 'flex', border: '1px solid #ccc', borderRadius: 1, overflow: 'hidden' }}>
              {[
                { val: 'all', label: `All` },
                { val: 'high', label: `High Conv (${highConvCount})`, color: '#1b5e20', bg: '#e8f5e9' },
                { val: 'high_bull', label: `HC Bull (${highConvBullCount})`, color: '#1b5e20', bg: '#e8f5e9' },
                { val: 'high_bear', label: `HC Bear (${highConvBearCount})`, color: '#c62828', bg: '#ffebee' },
                { val: 'weekly', label: `Wk Aligned (${weeklyAlignedCount})` },
                { val: 'entry_ready', label: `Entry Ready (${entryReadyCount})`, color: '#1565c0', bg: '#e3f2fd' },
                { val: 'done', label: `Done (${doneCount})`, color: '#6d4c41', bg: '#efebe9' },
                { val: 'actionable', label: `Actionable (${actionableCount})` },
                { val: 'monthly_setup', label: `Monthly Setup (${monthlySetupCount})`, color: '#0d47a1', bg: '#e3f2fd' },
              ].map(opt => (
                <Button key={opt.val} size="small"
                  onClick={() => {
                    setPage(1);
                    if (opt.val === 'all') {
                      setConvFilters([]);
                      return;
                    }
                    setConvFilters((prev) =>
                      prev.includes(opt.val)
                        ? prev.filter((v) => v !== opt.val)
                        : [...prev, opt.val]
                    );
                  }}
                  sx={{ textTransform: 'none', px: 1.5, borderRadius: 0, fontSize: 11,
                    fontWeight: (opt.val === 'all' ? convFilters.length === 0 : convFilters.includes(opt.val)) ? 700 : 400,
                    bgcolor: (opt.val === 'all' ? convFilters.length === 0 : convFilters.includes(opt.val)) ? '#1a3c5e' : 'transparent',
                    color: (opt.val === 'all' ? convFilters.length === 0 : convFilters.includes(opt.val)) ? '#fff' : '#333',
                    '&:hover': {
                      bgcolor: (opt.val === 'all' ? convFilters.length === 0 : convFilters.includes(opt.val))
                        ? '#1a3c5e'
                        : '#f5f5f5'
                    } }}>
                  {opt.label}
                </Button>
              ))}
            </Box>
            {convFilters.length > 0 && (
              <Chip
                size="small"
                label={`AND: ${convFilters.join(' + ')}`}
                onDelete={() => { setConvFilters([]); setPage(1); }}
                sx={{ fontSize: 10, bgcolor: '#e3f2fd', color: '#0d47a1' }}
              />
            )}
            <Button size="small" variant={showAll ? 'contained' : 'outlined'}
              onClick={() => { setShowAll(p => !p); setPage(1); }}
              sx={{ textTransform: 'none', fontSize: 11, px: 1.5, minWidth: 0,
                bgcolor: showAll ? '#1a3c5e' : 'transparent',
                color: showAll ? '#fff' : '#1a3c5e', borderColor: '#1a3c5e',
                '&:hover': { bgcolor: showAll ? '#0b3d91' : '#e3f2fd' } }}>
              {showAll ? 'Paged' : `Show All (${filteredSignals.length})`}
            </Button>
            <Tooltip title="Select all visible symbols">
              <Button size="small" variant="outlined" startIcon={<MdSelectAll />}
                onClick={() => {
                  const visibleSyms = paged.map(s => s.symbol);
                  setCheckedSymbols(prev => {
                    const allChecked = visibleSyms.every(s => prev.has(s));
                    const next = new Set(prev);
                    if (allChecked) visibleSyms.forEach(s => next.delete(s));
                    else visibleSyms.forEach(s => next.add(s));
                    return next;
                  });
                }}
                sx={{ textTransform: 'none', fontSize: 11, px: 1.5, minWidth: 0,
                  borderColor: '#1a3c5e', color: '#1a3c5e',
                  '&:hover': { bgcolor: '#e3f2fd' } }}>
                {checkedSymbols.size > 0 ? `${checkedSymbols.size} selected` : 'Select All'}
              </Button>
            </Tooltip>
            <Tooltip title={copied ? 'Copied!' : `Copy ${checkedSymbols.size > 0 ? 'selected' : 'all filtered'} as TradingView CSV`}>
              <Button size="small" variant="outlined"
                startIcon={copied ? <MdCheck /> : <MdContentCopy />}
                onClick={() => {
                  const syms = checkedSymbols.size > 0
                    ? [...checkedSymbols]
                    : filteredSignals.map(s => s.symbol);
                  const csv = syms.map(s => `NSE:${s}`).join(',');
                  navigator.clipboard.writeText(csv).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  });
                }}
                sx={{
                  textTransform: 'none', fontSize: 11, px: 1.5, minWidth: 0,
                  borderColor: copied ? '#2e7d32' : '#1a3c5e',
                  color: copied ? '#2e7d32' : '#1a3c5e',
                  '&:hover': { borderColor: '#0b3d91', bgcolor: '#e3f2fd' },
                }}>
                {copied ? 'Copied!' : `Copy (${checkedSymbols.size > 0 ? checkedSymbols.size : filteredSignals.length})`}
              </Button>
            </Tooltip>
            <Button
              size="small"
              variant="contained"
              disabled={checkedSymbols.size === 0}
              onClick={() => handleAddSelected('short_term')}
              sx={{ textTransform: 'none', fontSize: 11, px: 1.5, minWidth: 0, bgcolor: '#1565c0' }}
            >
              {`Add ST (${checkedSymbols.size})`}
            </Button>
            <Button
              size="small"
              variant="contained"
              disabled={checkedSymbols.size === 0}
              onClick={() => handleAddSelected('long_term')}
              sx={{ textTransform: 'none', fontSize: 11, px: 1.5, minWidth: 0, bgcolor: '#2e7d32' }}
            >
              {`Add LT (${checkedSymbols.size})`}
            </Button>
            {checkedSymbols.size > 0 && (
              <Button size="small" onClick={() => setCheckedSymbols(new Set())}
                sx={{ textTransform: 'none', fontSize: 11, px: 1, color: '#888', minWidth: 0 }}>
                Clear
              </Button>
            )}
            {signalPayload?.high_conviction_bullish_count != null && (
              <Chip
                size="small"
                label={`API HC Split ${signalPayload.high_conviction_bullish_count}/${signalPayload.high_conviction_bearish_count}`}
                sx={{ fontSize: 10, bgcolor: '#f3e5f5', color: '#6a1b9a', fontWeight: 700 }}
              />
            )}
          </Box>
        )}
        {view === 'alerts' && (
          <Select size="small" value={sourceFilter} onChange={e => { setSourceFilter(e.target.value); setPage(1); }} displayEmpty sx={{ width: 120 }}>
            <MenuItem value="">All Sources</MenuItem>
            <MenuItem value="intraday">Intraday</MenuItem>
            <MenuItem value="eod">EOD</MenuItem>
            <MenuItem value="ai">AI</MenuItem>
            <MenuItem value="youtube_strategy">Strategy</MenuItem>
          </Select>
        )}
        <TextField size="small" placeholder="Symbol…" value={symbolFilter}
          onChange={e => { setSymbolFilter(e.target.value); setPage(1); }} sx={{ width: 110 }} />
      </Box>

      {(view === 'signals' ? signalsLoading : alertsLoading) ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
      ) : view === 'signals' ? (
        <TableWrapper>
          <Table style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ ...compact, width: 30, padding: '4px' }}>
                  <Checkbox size="small" sx={{ p: 0, color: '#fff', '&.Mui-checked': { color: '#fff' } }}
                    checked={paged.length > 0 && paged.every(r => checkedSymbols.has(r.symbol))}
                    indeterminate={paged.some(r => checkedSymbols.has(r.symbol)) && !paged.every(r => checkedSymbols.has(r.symbol))}
                    onChange={() => {
                      const visibleSyms = paged.map(s => s.symbol);
                      setCheckedSymbols(prev => {
                        const allChecked = visibleSyms.every(s => prev.has(s));
                        const next = new Set(prev);
                        if (allChecked) visibleSyms.forEach(s => next.delete(s));
                        else visibleSyms.forEach(s => next.add(s));
                        return next;
                      });
                    }} />
                </th>
                {SIG_COLS.map(col => (
                  <th key={col.key} style={{ ...compact, cursor: col.key !== '_actions' ? 'pointer' : 'default', userSelect: 'none' }}
                    onClick={() => handleSort(col.key)}>
                    {col.label}<SortIcon col={col.key} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map((s, i) => {
                const cmp = s.cmp;
                const pctEntry = s.pct_from_entry;
                const pctColor = pctEntry != null
                  ? (Math.abs(pctEntry) <= 2 ? '#1b5e20' : Math.abs(pctEntry) <= 5 ? '#f57f17' : '#c62828')
                  : '#888';
                const tColor = trendColors[s.trend] || '#666';
                const isBull = s.trend === 'bullish';
                const tgtColor = isBull ? '#1b5e20' : '#c62828';
                const slColor = isBull ? '#c62828' : '#1b5e20';
                const isChecked = checkedSymbols.has(s.symbol);
                const rowBg = isChecked ? '#e3f2fd' : s.high_conviction ? '#e8f5e9' : s.weekly_aligned ? '#f0f8ff' : s.actionable ? '#fafffe' : undefined;
                const tier = s.buy_sell_tier;
                const tierColor = tier?.startsWith('B') ? '#1b5e20' : tier?.startsWith('S') ? '#c62828' : '#666';
                const tierBg = tier?.startsWith('B') ? '#e8f5e9' : tier?.startsWith('S') ? '#ffebee' : '#f5f5f5';
                const wkColor = s.weekly_trend === 'bullish' ? '#1b5e20' : s.weekly_trend === 'bearish' ? '#c62828' : '#888';
                const strategyTags = deriveStrategyTags(s);
                return (
                <tr key={`sig-${s.symbol}-${i}`} style={{ background: rowBg }}>
                  <td style={{ padding: '4px', textAlign: 'center' }}>
                    <Checkbox size="small" sx={{ p: 0 }}
                      checked={isChecked}
                      onChange={() => setCheckedSymbols(prev => {
                        const next = new Set(prev);
                        if (next.has(s.symbol)) next.delete(s.symbol); else next.add(s.symbol);
                        return next;
                      })} />
                  </td>
                  <td style={{ ...compact, fontWeight: 700 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {s.symbol}
                      <a
                        href={`https://www.tradingview.com/chart/?symbol=NSE%3A${encodeURIComponent(s.symbol)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`View ${s.symbol} on TradingView`}
                        style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 18, height: 18, borderRadius: '50%', background: '#131722',
                          textDecoration: 'none', flexShrink: 0,
                        }}
                      >
                        <svg width="10" height="10" viewBox="0 0 36 28" fill="none">
                          <path d="M14 22H7V11h7v11zm11 0h-7V6h7v16zm11 0h-7V0h7v22z" fill="#2962FF"/>
                          <rect y="25" width="36" height="3" rx="1.5" fill="#2962FF"/>
                        </svg>
                      </a>
                      {s.high_conviction && (
                        <span style={{ fontSize: 8, padding: '1px 4px', borderRadius: 2,
                          background: '#1b5e20', color: '#fff', fontWeight: 700, verticalAlign: 'super' }}>HC</span>
                      )}
                    </span>
                  </td>
                  <td style={{ ...compact, fontWeight: 700, color: s.conviction_score >= 100 ? '#1b5e20' : s.conviction_score >= 80 ? '#2e7d32' : '#333' }}>
                    {s.conviction_score?.toFixed(0)}
                  </td>
                  <td style={compact}>
                    <Chip
                      label={String(s.status || 'in_trade').replace(/_/g, ' ')}
                      size="small"
                      sx={{
                        fontSize: 9,
                        height: 17,
                        textTransform: 'uppercase',
                        fontWeight: 700,
                        bgcolor: s.status === 'done' ? '#efebe9' : s.status === 'entry_ready' ? '#e3f2fd' : '#f1f8e9',
                        color: s.status === 'done' ? '#6d4c41' : s.status === 'entry_ready' ? '#1565c0' : '#33691e',
                      }}
                    />
                  </td>
                  <td style={compact}>
                    {tier ? (
                      <Chip label={tier} size="small" sx={{ fontSize: 10, height: 18, fontWeight: 700,
                        bgcolor: tierBg, color: tierColor, minWidth: 28 }} />
                    ) : <span style={{ color: '#ccc', fontSize: 10 }}>—</span>}
                  </td>
                  <td style={{ ...compact, color: tColor, fontWeight: 600 }}>{trendLabel(s.trend, s.signal_type)}</td>
                  <td style={{ ...compact, minWidth: 190 }}>
                    {strategyTags.length ? (
                      <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4 }}>
                        {strategyTags.map((tag) => (
                          <Chip
                            key={`${s.symbol}-${tag.label}`}
                            label={tag.label}
                            size="small"
                            sx={{
                              fontSize: 9,
                              height: 17,
                              fontWeight: 700,
                              bgcolor: tag.tone === 'bear' ? '#ffebee' : '#e8f5e9',
                              color: tag.tone === 'bear' ? '#b71c1c' : '#1b5e20',
                            }}
                          />
                        ))}
                      </span>
                    ) : (
                      <span style={{ color: '#bbb', fontSize: 10 }}>—</span>
                    )}
                  </td>
                  <td style={{ ...compact, color: wkColor, fontWeight: 600 }}>
                    {s.weekly_trend ? (s.weekly_trend.charAt(0).toUpperCase() + s.weekly_trend.slice(1)) : '—'}
                    {s.weekly_aligned && <span style={{ fontSize: 8, marginLeft: 2, color: '#1b5e20' }}>✓</span>}
                  </td>
                  <td style={{ ...compact, fontWeight: 600 }}>
                    {cmp ? fmt(cmp) : '—'}
                    {pctEntry != null && (
                      <span style={{ fontSize: 9, color: pctColor, marginLeft: 2 }}>
                        ({pctEntry > 0 ? '+' : ''}{pctEntry}%)
                      </span>
                    )}
                  </td>
                  <td style={{ ...compact, fontWeight: 600, color: '#1565c0' }}>{fmt(s.entry_price)}</td>
                  <td style={{ ...compact }}>
                    {(() => {
                      const trail = getTrailingState(s);
                      if (trail.effectiveStopLoss == null) return '—';
                      return (
                        <span style={{ color: trail.costExit ? '#c62828' : trail.t1Hit ? '#1565c0' : slColor, fontWeight: trail.t1Hit ? 700 : 400 }}>
                          ₹{trail.effectiveStopLoss.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          {trail.costExit ? ' (C2C Exit)' : trail.t1Hit ? ' (Trail @ Cost)' : ''}
                        </span>
                      );
                    })()}
                  </td>
                  <td style={{ ...compact, color: slColor, fontSize: 10 }}>{s.sl_pct != null ? `${s.sl_pct}%` : '—'}</td>
                  <td style={{ ...compact, fontWeight: 600, color: tgtColor }}>{fmt(s.target_1)}</td>
                  <td style={compact}>{fmt(s.target_2)}</td>
                  <td style={{ ...compact, fontWeight: s.further_scope ? 700 : 400, color: s.further_scope ? '#2e7d32' : '#888' }}>
                    {s.further_scope ? fmt(s.next_scope_target) : (s.target_done ? 'Done' : '—')}
                  </td>
                  <td style={{ ...compact, fontSize: 10, maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.sector || '—'}</td>
                </tr>
                );
              })}
              {paged.length === 0 && <tr><td colSpan={SIG_COLS.length + 1} style={{ textAlign: 'center', padding: 24, color: '#888' }}>No signals matching filters.</td></tr>}
            </tbody>
          </Table>
        </TableWrapper>
      ) : (
        <TableWrapper>
          <Table style={{ fontSize: 12 }}>
            <thead>
              <tr>
                {ALERT_COLS.map(col => (
                  <th key={col.key} style={{ ...compact, cursor: col.key !== '_actions' && col.key !== '_read' ? 'pointer' : 'default', userSelect: 'none' }}
                    onClick={() => handleSort(col.key)}>
                    {col.label}<SortIcon col={col.key} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map(a => (
                <tr key={a.id} style={{ opacity: a.is_read ? 0.55 : 1, background: !a.is_read ? '#fffde7' : undefined }}>
                  <td style={compact}>{a.timestamp?.replace('T', ' ').slice(0, 16) || '—'}</td>
                  <td style={{ ...compact, fontWeight: 600 }}>{a.symbol}</td>
                  <td style={{ ...compact, fontWeight: 600, color: '#1565c0' }}>{fmt(a.entry_price)}</td>
                  <td style={{ ...compact, fontWeight: 600, color: '#c62828' }}>{fmt(a.stop_loss)}</td>
                  <td style={{ ...compact, fontWeight: 600, color: '#2e7d32' }}>{fmt(a.target_1)}</td>
                  <td style={compact}>{fmt(a.target_2)}</td>
                  <td style={{ ...compact, textAlign: 'center' }}>{a.signal_score != null ? a.signal_score : '—'}</td>
                  <td style={compact}>
                    {!a.is_read && (
                      <Button size="small" onClick={() => handleMarkRead(a.id)}
                        sx={{ textTransform: 'none', fontSize: 10, minWidth: 36, p: '1px 4px' }}>Read</Button>
                    )}
                  </td>
                </tr>
              ))}
              {paged.length === 0 && (
                <tr><td colSpan={ALERT_COLS.length} style={{ textAlign: 'center', padding: 24, color: '#888' }}>No alerts matching filters.</td></tr>
              )}
            </tbody>
          </Table>
        </TableWrapper>
      )}

      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Pagination count={totalPages} page={page} onChange={(_, v) => setPage(v)} color="primary" />
        </Box>
      )}
    </>
  );
}


function AnalysisResultCard({ data, title }) {
  if (!data) return null;
  const d = typeof data === 'string' ? (() => { try { return JSON.parse(data); } catch { return null; } })() : data;
  if (!d) return <Box sx={{ bgcolor: '#f8f9fa', p: 2, borderRadius: 2, mb: 2, fontSize: 13 }}>{data}</Box>;

  const renderVal = (v) => {
    if (v === null || v === undefined) return '—';
    if (Array.isArray(v)) return v.map((item, i) => <li key={i} style={{ marginBottom: 2 }}>{typeof item === 'object' ? JSON.stringify(item) : String(item)}</li>);
    if (typeof v === 'object') return <pre style={{ margin: 0, fontSize: 12 }}>{JSON.stringify(v, null, 2)}</pre>;
    return String(v);
  };
  const labelStyle = { fontWeight: 600, color: '#1a3c5e', textTransform: 'capitalize', verticalAlign: 'top', padding: '4px 10px 4px 0', whiteSpace: 'nowrap', fontSize: 12 };
  const valStyle = { padding: '4px 0', lineHeight: 1.4, fontSize: 12 };

  const ratingColor = { strong_buy: '#1b5e20', buy: '#2e7d32', hold: '#f57f17', sell: '#c62828', strong_sell: '#b71c1c' };
  const rating = d.rating || d.recommendation;
  const confidence = d.confidence;

  return (
    <Box sx={{ bgcolor: '#f8f9fa', p: 2, borderRadius: 2, mb: 2, maxHeight: 450, overflow: 'auto' }}>
      {title && <Box sx={{ fontWeight: 700, fontSize: 14, mb: 1, color: '#1a3c5e' }}>{title}</Box>}
      {(rating || confidence != null) && (
        <Box sx={{ display: 'flex', gap: 2, mb: 1, alignItems: 'center' }}>
          {rating && <Chip label={String(rating).replace(/_/g, ' ').toUpperCase()} size="small"
            sx={{ bgcolor: ratingColor[rating] || '#666', color: '#fff', fontWeight: 700, fontSize: 11 }} />}
          {confidence != null && <span style={{ fontSize: 12, color: '#555' }}>Confidence: <strong>{confidence}%</strong></span>}
          {d.target_price && <span style={{ fontSize: 12, color: '#555' }}>Target: <strong>₹{d.target_price}</strong></span>}
          {d.horizon && <span style={{ fontSize: 12, color: '#555' }}>Horizon: <strong>{String(d.horizon).replace(/_/g, ' ')}</strong></span>}
        </Box>
      )}
      {d.summary && <Box sx={{ fontSize: 13, mb: 1, lineHeight: 1.5 }}>{d.summary}</Box>}
      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
        <tbody>
          {Object.entries(d).filter(([k]) => !['summary', 'rating', 'confidence', 'target_price', 'horizon'].includes(k)).map(([k, v]) => (
            <tr key={k} style={{ borderBottom: '1px solid #e0e0e0' }}>
              <td style={labelStyle}>{k.replace(/_/g, ' ')}</td>
              <td style={valStyle}>{Array.isArray(v) ? <ul style={{ margin: 0, paddingLeft: 16 }}>{renderVal(v)}</ul> : renderVal(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Box>
  );
}

function AnalysisTab() {
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [analysisType, setAnalysisType] = useState('earnings');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [compareSyms, setCompareSyms] = useState([]);
  const [compareResult, setCompareResult] = useState(null);
  const allSymbols = useSymbolList();

  const handleAnalyze = async () => {
    const sym = typeof selectedSymbol === 'string' ? selectedSymbol : selectedSymbol?.symbol;
    if (!sym) return;
    setLoading(true);
    try {
      const res = await triggerAnalysis(sym.toUpperCase(), analysisType);
      setResult(res?.result || res);
      const hist = await fetchAnalysis(sym.toUpperCase());
      setHistory(hist);
    } catch (e) {
      alert(e?.message || 'Analysis failed');
    }
    setLoading(false);
  };

  const handleCompare = async () => {
    const syms = compareSyms.map(s => typeof s === 'string' ? s : s.symbol).filter(Boolean);
    if (syms.length < 2) { alert('Select 2-3 symbols to compare'); return; }
    setLoading(true);
    try {
      const res = await compareStocks(syms);
      setCompareResult(res?.result || res);
    } catch (e) {
      alert(e?.message || 'Compare failed');
    }
    setLoading(false);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Autocomplete
          size="small"
          options={allSymbols}
          getOptionLabel={opt => typeof opt === 'string' ? opt : `${opt.symbol} — ${opt.sector || ''}`}
          isOptionEqualToValue={(opt, val) => (opt.symbol || opt) === (val.symbol || val)}
          filterOptions={(opts, { inputValue }) => {
            const q = inputValue.toLowerCase();
            return opts.filter(o =>
              o.symbol.toLowerCase().includes(q) ||
              (o.sector || '').toLowerCase().includes(q)
            ).slice(0, 40);
          }}
          value={selectedSymbol}
          onChange={(_, val) => setSelectedSymbol(val)}
          renderInput={(params) => <TextField {...params} placeholder="Select symbol…" />}
          sx={{ width: 220 }}
          autoHighlight
        />
        <Select size="small" value={analysisType} onChange={e => setAnalysisType(e.target.value)} sx={{ width: 170 }}>
          <MenuItem value="earnings">Earnings</MenuItem>
          <MenuItem value="deep_review">Deep Review</MenuItem>
          <MenuItem value="growth">Growth Fundamentals</MenuItem>
          <MenuItem value="equity_report">Equity Report</MenuItem>
          <MenuItem value="weekly_research">Weekly Research</MenuItem>
        </Select>
        <Button variant="contained" size="small" onClick={handleAnalyze} disabled={loading || !selectedSymbol}
          sx={{ bgcolor: '#1a3c5e', textTransform: 'none', fontSize: 12 }}>
          {loading ? 'Analysing…' : 'Analyse'}
        </Button>
        <Box sx={{ width: 16 }} />
        <Autocomplete
          multiple
          size="small"
          options={allSymbols}
          getOptionLabel={opt => typeof opt === 'string' ? opt : `${opt.symbol}`}
          isOptionEqualToValue={(opt, val) => (opt.symbol || opt) === (val.symbol || val)}
          filterOptions={(opts, { inputValue }) => {
            const q = inputValue.toLowerCase();
            return opts.filter(o => o.symbol.toLowerCase().includes(q)).slice(0, 30);
          }}
          value={compareSyms}
          onChange={(_, val) => setCompareSyms(val.slice(0, 3))}
          renderInput={(params) => <TextField {...params} placeholder="Compare 2-3…" />}
          sx={{ width: 240 }}
          autoHighlight
          disableCloseOnSelect
        />
        <Button variant="outlined" size="small" onClick={handleCompare} disabled={loading || compareSyms.length < 2}
          sx={{ textTransform: 'none', fontSize: 12 }}>Compare</Button>
      </Box>

      {loading && <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress /></Box>}
      {result && !loading && <AnalysisResultCard data={result} />}
      {compareResult && !loading && <AnalysisResultCard data={compareResult} title="Comparison Result" />}

      {history.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Box sx={{ fontWeight: 600, mb: 1, fontSize: 13 }}>Analysis History</Box>
          <TableWrapper>
            <Table style={{ fontSize: 12 }}>
              <thead>
                <tr><th style={compact}>Type</th><th style={compact}>Rating</th><th style={compact}>Confidence</th><th style={compact}>Target</th><th style={compact}>Horizon</th><th style={compact}>Provider</th><th style={compact}>Date</th></tr>
              </thead>
              <tbody>
                {history.map(h => (
                  <tr key={h.id}>
                    <td style={compact}>{h.analysis_type}</td>
                    <td style={compact}>{h.rating || '—'}</td>
                    <td style={compact}>{h.confidence != null ? `${h.confidence}%` : '—'}</td>
                    <td style={compact}>{h.target_price ? `₹${h.target_price}` : '—'}</td>
                    <td style={compact}>{h.horizon || '—'}</td>
                    <td style={compact}>{h.llm_provider}</td>
                    <td style={compact}>{h.created_at?.split('T')[0]}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrapper>
        </Box>
      )}
    </Box>
  );
}

function PortfolioTab() {
  const [selectedSymbols, setSelectedSymbols] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const allSymbols = useSymbolList();

  const handleCheck = async () => {
    const syms = selectedSymbols.map(s => typeof s === 'string' ? s : s.symbol).filter(Boolean);
    if (!syms.length) return;
    setLoading(true);
    try {
      const res = await fetchPortfolioHealth(syms);
      setResult(res);
    } catch (e) {
      alert(e?.message || 'Failed');
    }
    setLoading(false);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
        <Autocomplete
          multiple
          size="small"
          options={allSymbols}
          getOptionLabel={opt => typeof opt === 'string' ? opt : `${opt.symbol} — ${opt.sector || ''}`}
          isOptionEqualToValue={(opt, val) => (opt.symbol || opt) === (val.symbol || val)}
          filterOptions={(opts, { inputValue }) => {
            const q = inputValue.toLowerCase();
            return opts.filter(o =>
              o.symbol.toLowerCase().includes(q) ||
              (o.sector || '').toLowerCase().includes(q)
            ).slice(0, 40);
          }}
          value={selectedSymbols}
          onChange={(_, val) => setSelectedSymbols(val)}
          renderInput={(params) => <TextField {...params} placeholder="Select portfolio stocks…" />}
          sx={{ width: 400 }}
          autoHighlight
          disableCloseOnSelect
        />
        <Button variant="contained" size="small" onClick={handleCheck} disabled={loading || selectedSymbols.length === 0}
          sx={{ bgcolor: '#1a3c5e', textTransform: 'none', fontSize: 12 }}>
          {loading ? 'Checking…' : 'Check Health'}
        </Button>
      </Box>

      {loading && <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress /></Box>}

      {result && !loading && (
        <Box sx={{ bgcolor: '#f8f9fa', p: 2, borderRadius: 2, fontFamily: 'monospace', fontSize: 12, maxHeight: 500, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
          {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
        </Box>
      )}
    </Box>
  );
}

export default FinancialAdvisorPage;
