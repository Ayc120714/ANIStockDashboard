import React, { useState, useEffect, useMemo, useCallback, useDeferredValue } from 'react';
import { TableSection, TableTitle, TableWrapper, Table } from './SectorOutlook.styles';
import { Box, TextField, Button, Chip, CircularProgress, Tabs, Tab, Select, MenuItem, Autocomplete, Tooltip, Checkbox, Alert, Typography } from '@mui/material';
import Pagination from '@mui/material/Pagination';
import { MdCheck, MdContentCopy, MdSelectAll } from 'react-icons/md';
import { FaSortUp, FaSortDown, FaSort } from 'react-icons/fa';
import { fetchLatestSignalsPayload, fetchMonthlyMacdSetup, fetchCustomRsMacdSetup, fetchMondayPrevWeekHighCross, fetchAlerts, markAlertRead, triggerAnalysis, fetchAnalysis, fetchPortfolioHealth, compareStocks, refreshAdvisor } from '../api/advisor';
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

function parseMaybeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function hasBullishMacdCross(row, timeframe = 'daily') {
  const tf = String(timeframe || 'daily').toLowerCase();
  const prefix = tf === 'daily' ? '' : `${tf}_`;
  const backendFlag = row?.[`${prefix}macd_cross_up`];
  if (typeof backendFlag === 'boolean') return backendFlag;
  const crossRaw = String(
    row?.[`${prefix}macd_cross`]
    ?? row?.[`${prefix}macd_state`]
    ?? row?.[`${prefix}macd_signal_state`]
    ?? ''
  ).toLowerCase();
  if (
    crossRaw.includes('bull')
    || crossRaw.includes('cross_above')
    || crossRaw.includes('cross up')
    || crossRaw.includes('buy')
  ) {
    return true;
  }
  const macd = parseMaybeNumber(row?.[`${prefix}macd`]);
  const signal = parseMaybeNumber(row?.[`${prefix}macd_signal`] ?? row?.[`${prefix}macd_signal_line`]);
  const hist = parseMaybeNumber(row?.[`${prefix}macd_histogram`] ?? row?.[`${prefix}macd_hist`]);
  if (macd != null && signal != null && macd > signal) return true;
  if (hist != null && hist > 0) return true;
  return false;
}

function hasGreenHistogramBuilding(row, timeframe = 'daily') {
  const tf = String(timeframe || 'daily').toLowerCase();
  const prefix = tf === 'daily' ? '' : `${tf}_`;
  const recentFlipFlag = row?.[`${prefix}hist_red_to_green_recent`];
  if (typeof recentFlipFlag === 'boolean' && recentFlipFlag) return true;
  const flipFlag = row?.[`${prefix}hist_red_to_green`];
  if (typeof flipFlag === 'boolean') return flipFlag;
  const serverFlag = row?.[`${prefix}green_hist_building`];
  if (typeof serverFlag === 'boolean') return serverFlag;
  const hist = parseMaybeNumber(row?.[`${prefix}macd_histogram`] ?? row?.[`${prefix}macd_hist`]);
  return hist != null && hist > 0;
}

function hasMonthlyMacdBullCondition(row) {
  if (typeof row?.monthly_macd_positive === 'boolean' && typeof row?.monthly_macd_bull_signal_condition === 'boolean') {
    return row.monthly_macd_positive && row.monthly_macd_bull_signal_condition;
  }
  const macd = parseMaybeNumber(row?.monthly_macd ?? row?.monthly_macd_value ?? row?.monthly_macd_line);
  const signal = parseMaybeNumber(row?.monthly_macd_signal ?? row?.monthly_signal ?? row?.monthly_signal_line);
  const crossUp = hasBullishMacdCross(row, 'monthly');
  return Boolean(macd != null && macd > 0 && ((signal != null && macd > signal) || crossUp));
}

function customScreenerSetupChips(row) {
  const tags = [];
  if (!row) return tags;
  if (String(row.setup_mode || '') === 'or_signal') {
    if (row.or_signal_macd_weekly) tags.push({ label: 'W-MACD', tone: 'bull' });
    if (row.or_signal_macd_monthly) tags.push({ label: 'M-MACD', tone: 'bull' });
    if (row.or_signal_psar) tags.push({ label: 'PSAR', tone: 'bull' });
    if (row.or_signal_rvol) tags.push({ label: 'RVOL', tone: 'bull' });
    return tags;
  }
  if (row.setup_mode === 'strict') {
    tags.push({ label: 'Strict RS+MACD+PSAR', tone: 'bull' });
  }
  return tags;
}

function deriveStrategyTags(row) {
  const tags = [];
  if (hasBullishMacdCross(row, 'weekly') && hasGreenHistogramBuilding(row, 'weekly')) {
    tags.push({ label: 'Weekly MACD Cross + Red->Green Hist', tone: 'bull' });
  }
  if (row?.monthly_setup_rule || row?.monthly_psar_macd_rule || row?.monthly_qualified) {
    tags.push({ label: 'Monthly MACD+PSAR', tone: 'bull' });
  }
  if (hasBullishMacdCross(row, 'monthly') && hasGreenHistogramBuilding(row, 'monthly') && hasMonthlyMacdBullCondition(row)) {
    tags.push({ label: 'Monthly MACD Cross + Red->Green Hist', tone: 'bull' });
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

const CUSTOM_RS_TABLE_DISPLAY_LIMIT = 20;
const MONDAY_PWH_TABLE_PAGE_SIZE = 10;

function parseSortableNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Nulls / NaN last. mul +1 = ascending, -1 = descending */
function cmpNullableNumber(a, b, mul) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return mul * (a - b);
}

/** Empty strings last */
function cmpNullableString(a, b, mul) {
  const sa = a != null ? String(a) : '';
  const sb = b != null ? String(b) : '';
  if (!sa && !sb) return 0;
  if (!sa) return 1;
  if (!sb) return -1;
  return mul * sa.localeCompare(sb, undefined, { sensitivity: 'base' });
}

function TradingViewLink({ symbol }) {
  const s = String(symbol || '').trim();
  if (!s) return null;
  return (
    <a
      href={`https://www.tradingview.com/chart/?symbol=NSE%3A${encodeURIComponent(s)}`}
      target="_blank"
      rel="noopener noreferrer"
      title={`View ${s} on TradingView`}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 18, height: 18, borderRadius: '50%', background: '#131722',
        textDecoration: 'none', flexShrink: 0,
      }}
    >
      <svg width="10" height="10" viewBox="0 0 36 28" fill="none">
        <path d="M14 22H7V11h7v11zm11 0h-7V6h7v16zm11 0h-7V0h7v22z" fill="#2962FF" />
        <rect y="25" width="36" height="3" rx="1.5" fill="#2962FF" />
      </svg>
    </a>
  );
}

function SignalsAlertsTab() {
  const SIGNAL_PAGE_SIZE_OPTIONS = [25, 50, 100, 300];
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
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [checkedSymbols, setCheckedSymbols] = useState(new Set());
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [customSetupRows, setCustomSetupRows] = useState([]);
  const [customSetupLoading, setCustomSetupLoading] = useState(false);
  const [customSetupMode, setCustomSetupMode] = useState('or_signal');
  const [customSetupPage, setCustomSetupPage] = useState(1);
  const [customSortCol, setCustomSortCol] = useState('');
  const [customSortDir, setCustomSortDir] = useState('desc');
  const [customSetupError, setCustomSetupError] = useState(null);
  const [mondayPwhRows, setMondayPwhRows] = useState([]);
  const [mondayPwhLoading, setMondayPwhLoading] = useState(false);
  const [mondayPwhError, setMondayPwhError] = useState(null);
  const [mondayPwhMeta, setMondayPwhMeta] = useState(null);
  const [mondayPwhPage, setMondayPwhPage] = useState(1);
  const deferredSymbolFilter = useDeferredValue(symbolFilter);

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

  const CustomTableSortIcon = ({ col }) => {
    if (customSortCol !== col) return <FaSort style={{ opacity: 0.35, marginLeft: 2, fontSize: 9 }} />;
    return customSortDir === 'asc'
      ? <FaSortUp style={{ color: '#fff', marginLeft: 2, fontSize: 9 }} />
      : <FaSortDown style={{ color: '#fff', marginLeft: 2, fontSize: 9 }} />;
  };

  const handleCustomTableSort = (col) => {
    if (!col) return;
    if (customSortCol === col) {
      setCustomSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setCustomSortCol(col);
      const stringAsc = ['symbol', 'status', 'sector', 'buy_sell_tier', 'trend', 'weekly_trend'].includes(col);
      setCustomSortDir(stringAsc ? 'asc' : 'desc');
    }
    setCustomSetupPage(1);
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
      ...(deferredSymbolFilter ? { symbol: deferredSymbolFilter } : {}),
    })
      .then(setAlertData)
      .catch(() => {})
      .finally(() => setAlertsLoading(false));
  }, [sourceFilter, deferredSymbolFilter]);

  useEffect(() => {
    loadSignals();
  }, [loadSignals]);

  const loadCustomSetup = useCallback((refresh = false) => {
    setCustomSetupLoading(true);
    setCustomSetupError(null);
    fetchCustomRsMacdSetup({ limit: 500, setup_mode: customSetupMode, refresh })
      .then((payload) => {
        setCustomSetupRows(Array.isArray(payload?.data) ? payload.data : []);
        setCustomSetupError(null);
      })
      .catch((err) => {
        setCustomSetupRows([]);
        setCustomSetupError(err?.message || 'Could not load the custom RS / MACD screen.');
      })
      .finally(() => setCustomSetupLoading(false));
  }, [customSetupMode]);

  useEffect(() => {
    if (view !== 'signals') return;
    loadCustomSetup(false);
  }, [view, loadCustomSetup]);

  const loadMondayPrevWeekHigh = useCallback((refresh = false) => {
    setMondayPwhLoading(true);
    setMondayPwhError(null);
    fetchMondayPrevWeekHighCross({ limit: 800, refresh, universe: 'all', require_cross: true })
      .then((payload) => {
        setMondayPwhRows(Array.isArray(payload?.data) ? payload.data : []);
        setMondayPwhMeta({
          reference_monday: payload?.reference_monday,
          anchor: payload?.anchor,
          rules: payload?.rules || {},
          cached: payload?.cached,
        });
      })
      .catch((err) => {
        setMondayPwhRows([]);
        setMondayPwhMeta(null);
        setMondayPwhError(err?.message || 'Could not load Monday vs prior week high list.');
      })
      .finally(() => setMondayPwhLoading(false));
  }, []);

  useEffect(() => {
    if (view !== 'signals') return;
    loadMondayPrevWeekHigh(false);
  }, [view, loadMondayPrevWeekHigh]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(mondayPwhRows.length / MONDAY_PWH_TABLE_PAGE_SIZE));
    setMondayPwhPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [mondayPwhRows.length]);

  useEffect(() => {
    setCustomSetupPage(1);
  }, [customSetupMode]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(customSetupRows.length / CUSTOM_RS_TABLE_DISPLAY_LIMIT));
    setCustomSetupPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [customSetupRows.length]);

  useEffect(() => {
    if (view !== 'signals') return;
    if (strategyFilter !== 'custom_rs_or_signal' && strategyFilter !== 'custom_rs_strict') return;
    const t = window.setTimeout(() => {
      document.getElementById('advisor-custom-rs-screen')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return () => window.clearTimeout(t);
  }, [view, strategyFilter]);

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
    if (deferredSymbolFilter) {
      const q = deferredSymbolFilter.toUpperCase();
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
      } else if (filterKey === 'macd_weekly_cross_up') {
        rows = rows.filter(s => hasBullishMacdCross(s, 'weekly') && hasGreenHistogramBuilding(s, 'weekly'));
      } else if (filterKey === 'macd_monthly_cross_up') {
        rows = rows.filter(s => (
          hasBullishMacdCross(s, 'monthly')
          && hasGreenHistogramBuilding(s, 'monthly')
          && hasMonthlyMacdBullCondition(s)
        ) || s.monthly_setup_rule || s.monthly_psar_macd_rule || s.monthly_qualified);
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
    } else if (strategyFilter === 'macd_cross_up_weekly') {
      rows = rows.filter(s => hasBullishMacdCross(s, 'weekly') && hasGreenHistogramBuilding(s, 'weekly'));
    } else if (strategyFilter === 'macd_cross_up_monthly') {
      rows = rows.filter(s => (
        hasBullishMacdCross(s, 'monthly')
        && hasGreenHistogramBuilding(s, 'monthly')
        && hasMonthlyMacdBullCondition(s)
      ) || s.monthly_setup_rule || s.monthly_psar_macd_rule || s.monthly_qualified);
    } else if (strategyFilter === 'vwap_cross_above') {
      rows = rows.filter(s => s.vwap_cross_quarter_above || s.vwap_cross_above || s.vwap_above_state);
    } else if (strategyFilter === 'vwap_cross_below') {
      rows = rows.filter(s => s.vwap_cross_quarter_below || s.vwap_cross_below || s.vwap_below_state);
    }
    return dedupeSignalsBySymbol(rows);
  }, [signalData, monthlySetupData, deferredSymbolFilter, convFilters, recoFilter, strategyFilter]);

  const uniqueSignalData = useMemo(
    () => dedupeSignalsBySymbol(signalData.filter(s => s.cmp && s.entry_price)),
    [signalData]
  );
  const signalStats = useMemo(() => ({
    highConvCount: uniqueSignalData.filter(s => s.high_conviction).length,
    highConvBullCount: uniqueSignalData.filter(s => s.high_conviction && String(s.trend || '').toLowerCase() === 'bullish').length,
    highConvBearCount: uniqueSignalData.filter(s => s.high_conviction && String(s.trend || '').toLowerCase() === 'bearish').length,
    weeklyAlignedCount: uniqueSignalData.filter(s => s.weekly_aligned).length,
    actionableCount: uniqueSignalData.filter(s => s.actionable).length,
    doneCount: uniqueSignalData.filter(s => s.target_done || s.status === 'done').length,
    entryReadyCount: uniqueSignalData.filter(s => s.status === 'entry_ready').length,
    macdWeeklyCrossUpCount: uniqueSignalData.filter(s => hasBullishMacdCross(s, 'weekly') && hasGreenHistogramBuilding(s, 'weekly')).length,
    macdMonthlyCrossUpCount: uniqueSignalData.filter(s => (
      hasBullishMacdCross(s, 'monthly')
      && hasGreenHistogramBuilding(s, 'monthly')
      && hasMonthlyMacdBullCondition(s)
    ) || s.monthly_setup_rule || s.monthly_psar_macd_rule || s.monthly_qualified).length,
  }), [uniqueSignalData]);
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

  const totalPages = Math.max(1, Math.ceil(sortedData.length / rowsPerPage));
  const paged = sortedData.slice((page - 1) * rowsPerPage, page * rowsPerPage);
  const listRangeStart = sortedData.length === 0 ? 0 : (page - 1) * rowsPerPage + 1;
  const listRangeEnd = Math.min(page * rowsPerPage, sortedData.length);
  const listLoading = view === 'signals' ? signalsLoading : alertsLoading;
  const safeListPage = Math.min(Math.max(1, page), totalPages);

  useEffect(() => {
    const tp = Math.max(1, Math.ceil(sortedData.length / rowsPerPage));
    setPage((p) => (p > tp ? tp : p));
  }, [sortedData.length, rowsPerPage]);

  const handleAdd = async (symbol, listType) => {
    const key = `${symbol}_${listType}`;
    if (added[key]) return;
    try {
      await addToWatchlist(symbol.toUpperCase(), listType, '');
      setAdded(prev => ({ ...prev, [key]: true }));
    } catch (_) { /* ignore */ }
  };

  const handleAddSelected = async (listType) => {
    const syms = [...checkedSymbols]
      .filter(Boolean)
      .filter((symbol) => !added[`${symbol}_${listType}`]);
    if (!syms.length) return;
    await Promise.allSettled(syms.map((symbol) => handleAdd(symbol, listType)));
  };

  const handleMarkRead = async (id) => {
    await markAlertRead(id);
    if (view === 'alerts') {
      loadAlerts();
    }
  };

  const signalBySymbolForCustom = useMemo(() => {
    const merged = dedupeSignalsBySymbol([...(signalData || []), ...(monthlySetupData || [])]);
    const m = new Map();
    for (const row of merged) {
      const k = String(row?.symbol || '').toUpperCase();
      if (k) m.set(k, row);
    }
    return m;
  }, [signalData, monthlySetupData]);

  const customSortedRows = useMemo(() => {
    const rows = [...(customSetupRows || [])];
    if (!customSortCol) return rows;
    const mul = customSortDir === 'asc' ? 1 : -1;
    rows.sort((ra, rb) => {
      const symA = String(ra.symbol || '').toUpperCase();
      const symB = String(rb.symbol || '').toUpperCase();
      const sa = signalBySymbolForCustom.get(symA);
      const sb = signalBySymbolForCustom.get(symB);
      let c = 0;
      switch (customSortCol) {
        case 'symbol':
          c = cmpNullableString(ra.symbol, rb.symbol, mul);
          break;
        case 'conviction_score':
          c = cmpNullableNumber(parseSortableNumber(sa?.conviction_score), parseSortableNumber(sb?.conviction_score), mul);
          break;
        case 'status':
          c = cmpNullableString(sa?.status, sb?.status, mul);
          break;
        case 'buy_sell_tier':
          c = cmpNullableString(sa?.buy_sell_tier, sb?.buy_sell_tier, mul);
          break;
        case 'trend':
          c = cmpNullableString(sa?.trend, sb?.trend, mul);
          break;
        case 'weekly_trend':
          c = cmpNullableString(sa?.weekly_trend, sb?.weekly_trend, mul);
          break;
        case 'cmp':
          c = cmpNullableNumber(parseSortableNumber(sa?.cmp ?? sa?.price), parseSortableNumber(sb?.cmp ?? sb?.price), mul);
          break;
        case 'entry_price':
          c = cmpNullableNumber(parseSortableNumber(sa?.entry_price), parseSortableNumber(sb?.entry_price), mul);
          break;
        case 'stop_loss':
          c = cmpNullableNumber(parseSortableNumber(sa?.stop_loss), parseSortableNumber(sb?.stop_loss), mul);
          break;
        case 'sl_pct':
          c = cmpNullableNumber(parseSortableNumber(sa?.sl_pct), parseSortableNumber(sb?.sl_pct), mul);
          break;
        case 'target_1':
          c = cmpNullableNumber(parseSortableNumber(sa?.target_1), parseSortableNumber(sb?.target_1), mul);
          break;
        case 'target_2':
          c = cmpNullableNumber(parseSortableNumber(sa?.target_2), parseSortableNumber(sb?.target_2), mul);
          break;
        case 'next_scope_target':
          c = cmpNullableNumber(parseSortableNumber(sa?.next_scope_target), parseSortableNumber(sb?.next_scope_target), mul);
          break;
        case 'sector':
          c = cmpNullableString(sa?.sector, sb?.sector, mul);
          break;
        case 'rs_daily':
          c = cmpNullableNumber(parseSortableNumber(ra.rs_daily_123), parseSortableNumber(rb.rs_daily_123), mul);
          break;
        case 'rs_weekly':
          c = cmpNullableNumber(parseSortableNumber(ra.rs_weekly_52), parseSortableNumber(rb.rs_weekly_52), mul);
          break;
        case 'rs_monthly':
          c = cmpNullableNumber(parseSortableNumber(ra.rs_monthly_12), parseSortableNumber(rb.rs_monthly_12), mul);
          break;
        case 'rvol':
          c = cmpNullableNumber(parseSortableNumber(ra.relative_volume), parseSortableNumber(rb.relative_volume), mul);
          break;
        default:
          c = 0;
      }
      if (c !== 0) return c;
      return cmpNullableString(ra.symbol, rb.symbol, 1);
    });
    return rows;
  }, [customSetupRows, customSortCol, customSortDir, signalBySymbolForCustom]);

  const customSetupTotalPages = Math.max(
    1,
    Math.ceil(customSortedRows.length / CUSTOM_RS_TABLE_DISPLAY_LIMIT)
  );
  const customDisplayedRows = useMemo(() => {
    const start = (customSetupPage - 1) * CUSTOM_RS_TABLE_DISPLAY_LIMIT;
    return customSortedRows.slice(start, start + CUSTOM_RS_TABLE_DISPLAY_LIMIT);
  }, [customSortedRows, customSetupPage]);
  const customRangeStart = customSortedRows.length === 0
    ? 0
    : (customSetupPage - 1) * CUSTOM_RS_TABLE_DISPLAY_LIMIT + 1;
  const customRangeEnd = Math.min(
    customSetupPage * CUSTOM_RS_TABLE_DISPLAY_LIMIT,
    customSortedRows.length
  );
  const mondayPwhTotalPages = Math.max(
    1,
    Math.ceil(mondayPwhRows.length / MONDAY_PWH_TABLE_PAGE_SIZE)
  );
  const mondayPwhDisplayedRows = useMemo(() => {
    const start = (mondayPwhPage - 1) * MONDAY_PWH_TABLE_PAGE_SIZE;
    return mondayPwhRows.slice(start, start + MONDAY_PWH_TABLE_PAGE_SIZE);
  }, [mondayPwhRows, mondayPwhPage]);
  const mondayRangeStart = mondayPwhRows.length === 0 ? 0 : ((mondayPwhPage - 1) * MONDAY_PWH_TABLE_PAGE_SIZE) + 1;
  const mondayRangeEnd = Math.min(mondayPwhPage * MONDAY_PWH_TABLE_PAGE_SIZE, mondayPwhRows.length);

  return (
    <>
      {view === 'signals' && (
        <Box id="advisor-monday-prev-week-high" sx={{ mb: 2 }}>
          <TableTitle style={{ fontSize: 15, marginBottom: 8, color: '#0b3d91' }}>
            Monday close above prior week high (cross)
          </TableTitle>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: 12, mb: 1, maxWidth: 920 }}>
            NSE stocks where the latest Monday session (from NIFTY calendar) closed above the prior seven-day window high,
            with the prior session at or below that high. Useful for weekly-break continuation after Monday&apos;s print.
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 1.5 }}>
            {mondayPwhMeta?.reference_monday && (
              <Chip
                size="small"
                label={`Ref Monday ${mondayPwhMeta.reference_monday}${mondayPwhMeta.anchor ? ` · anchor ${mondayPwhMeta.anchor}` : ''}`}
                sx={{ fontWeight: 600, borderColor: '#1565c0', color: '#0d47a1' }}
                variant="outlined"
              />
            )}
            <Chip
              size="small"
              label={
                mondayPwhRows.length === 0
                  ? '0 names'
                  : mondayPwhRows.length > MONDAY_PWH_TABLE_PAGE_SIZE
                    ? `${mondayRangeStart}–${mondayRangeEnd} of ${mondayPwhRows.length} (${MONDAY_PWH_TABLE_PAGE_SIZE}/page)`
                    : `${mondayPwhRows.length} names`
              }
              sx={{ fontWeight: 700, borderColor: '#1a3c5e', color: '#1a3c5e' }}
              variant="outlined"
            />
            {mondayPwhMeta?.cached && (
              <Chip size="small" label="Cached" sx={{ fontSize: 10, bgcolor: '#f3e5f5', color: '#6a1b9a' }} />
            )}
            <Button
              size="small"
              variant="outlined"
              disabled={mondayPwhLoading}
              onClick={() => loadMondayPrevWeekHigh(true)}
              sx={{ textTransform: 'none', fontSize: 12, borderColor: '#1a3c5e', color: '#1a3c5e' }}
            >
              Refresh
            </Button>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 1.5 }}>
            <Tooltip title="Select all symbols on this page of the Monday breakout list">
              <Button
                size="small"
                variant="outlined"
                startIcon={<MdSelectAll />}
                onClick={() => {
                  const visibleSyms = mondayPwhDisplayedRows.map((row) => row.symbol).filter(Boolean);
                  setCheckedSymbols((prev) => {
                    const allChecked = visibleSyms.length > 0 && visibleSyms.every((s) => prev.has(s));
                    const next = new Set(prev);
                    if (allChecked) visibleSyms.forEach((s) => next.delete(s));
                    else visibleSyms.forEach((s) => next.add(s));
                    return next;
                  });
                }}
                sx={{
                  textTransform: 'none', fontSize: 11, px: 1.5, minWidth: 0,
                  borderColor: '#1a3c5e', color: '#1a3c5e',
                  '&:hover': { bgcolor: '#e3f2fd' },
                }}
              >
                {checkedSymbols.size > 0 ? `${checkedSymbols.size} selected` : 'Select All'}
              </Button>
            </Tooltip>
            <Tooltip title={copied ? 'Copied!' : 'Copy selected symbols, or full Monday breakout list if none selected (TradingView CSV)'}>
              <Button
                size="small"
                variant="outlined"
                startIcon={copied ? <MdCheck /> : <MdContentCopy />}
                onClick={() => {
                  const syms = checkedSymbols.size > 0
                    ? [...checkedSymbols]
                    : mondayPwhRows.map((row) => row.symbol).filter(Boolean);
                  const csv = syms.map((s) => `NSE:${s}`).join(',');
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
                }}
              >
                {copied ? 'Copied!' : `Copy (${checkedSymbols.size > 0 ? checkedSymbols.size : mondayPwhRows.length})`}
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
              <Button
                size="small"
                onClick={() => setCheckedSymbols(new Set())}
                sx={{ textTransform: 'none', fontSize: 11, px: 1, color: '#888', minWidth: 0 }}
              >
                Clear
              </Button>
            )}
          </Box>
          {mondayPwhError && (
            <Alert severity="warning" onClose={() => setMondayPwhError(null)} sx={{ mb: 1.5, '& .MuiAlert-message': { fontSize: 13 } }}>
              {mondayPwhError}
            </Alert>
          )}
          {!mondayPwhLoading && mondayPwhRows.length > 0 && (
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1,
                mb: 1,
              }}
            >
              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: 12 }}>
                Monday breakout list: {mondayRangeStart}–{mondayRangeEnd} of {mondayPwhRows.length}
                {mondayPwhRows.length > MONDAY_PWH_TABLE_PAGE_SIZE ? ` (${MONDAY_PWH_TABLE_PAGE_SIZE} per page)` : ''}
              </Typography>
              {mondayPwhRows.length > MONDAY_PWH_TABLE_PAGE_SIZE && (
                <Pagination
                  count={mondayPwhTotalPages}
                  page={mondayPwhPage}
                  onChange={(_, v) => setMondayPwhPage(v)}
                  color="primary"
                  size="small"
                  siblingCount={1}
                  boundaryCount={1}
                />
              )}
            </Box>
          )}
          {mondayPwhLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={28} /></Box>
          ) : (
            <TableWrapper>
              <Table style={{ fontSize: 12, minWidth: 720 }}>
                <thead>
                  <tr>
                    <th style={{ ...compact, width: 30, padding: '4px', color: '#fff' }}>
                      <Checkbox
                        size="small"
                        sx={{ p: 0, color: '#fff', '&.Mui-checked': { color: '#fff' } }}
                        checked={
                          mondayPwhDisplayedRows.length > 0
                          && mondayPwhDisplayedRows.every((row) => checkedSymbols.has(row.symbol))
                        }
                        indeterminate={
                          mondayPwhDisplayedRows.some((row) => checkedSymbols.has(row.symbol))
                          && !mondayPwhDisplayedRows.every((row) => checkedSymbols.has(row.symbol))
                        }
                        onChange={() => {
                          const visible = mondayPwhDisplayedRows.map((row) => row.symbol).filter(Boolean);
                          setCheckedSymbols((prev) => {
                            const allChecked = visible.length > 0 && visible.every((sym) => prev.has(sym));
                            const next = new Set(prev);
                            if (allChecked) visible.forEach((sym) => next.delete(sym));
                            else visible.forEach((sym) => next.add(sym));
                            return next;
                          });
                        }}
                      />
                    </th>
                    <th style={{ ...compact, color: '#fff' }}>Symbol</th>
                    <th style={{ ...compact, color: '#fff' }}>Sector</th>
                    <th style={{ ...compact, color: '#fff' }}>Mon close</th>
                    <th style={{ ...compact, color: '#fff' }}>Prev wk high</th>
                    <th style={{ ...compact, color: '#fff' }}>Prior close</th>
                    <th style={{ ...compact, color: '#fff' }}>% vs prev high</th>
                  </tr>
                </thead>
                <tbody>
                  {mondayPwhDisplayedRows.map((r, i) => {
                    const sym = r.symbol;
                    const isChecked = sym && checkedSymbols.has(sym);
                    const pct = r.pct_above_prev_week_high != null ? Number(r.pct_above_prev_week_high) : null;
                    const pctColor = pct != null
                      ? (pct >= 8 ? '#1b5e20' : pct >= 5 ? '#2e7d32' : '#1565c0')
                      : '#888';
                    const rowBg = isChecked
                      ? '#e3f2fd'
                      : (pct != null && pct >= 8
                          ? '#e8f5e9'
                          : (pct != null && pct >= 5 ? '#f0f8ff' : undefined));
                    return (
                    <tr key={`mon-pwh-${sym}-${(mondayPwhPage - 1) * MONDAY_PWH_TABLE_PAGE_SIZE + i}`} style={{ background: rowBg }}>
                      <td style={{ padding: '4px', textAlign: 'center' }}>
                        <Checkbox
                          size="small"
                          sx={{ p: 0 }}
                          checked={Boolean(sym && isChecked)}
                          onChange={() => {
                            if (!sym) return;
                            setCheckedSymbols((prev) => {
                              const next = new Set(prev);
                              if (next.has(sym)) next.delete(sym);
                              else next.add(sym);
                              return next;
                            });
                          }}
                        />
                      </td>
                      <td style={{ ...compact, fontWeight: 700 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {r.symbol}
                          <TradingViewLink symbol={r.symbol} />
                        </span>
                      </td>
                      <td style={{ ...compact, fontSize: 11, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.sector || '—'}</td>
                      <td style={{ ...compact, fontWeight: 600 }}>{r.monday_close != null ? fmt(r.monday_close) : '—'}</td>
                      <td style={{ ...compact, color: '#1565c0', fontWeight: 600 }}>{r.prev_week_high != null ? fmt(r.prev_week_high) : '—'}</td>
                      <td style={compact}>
                        {r.prior_session_close != null ? fmt(r.prior_session_close) : '—'}
                        {r.prior_session_date && (
                          <span style={{ fontSize: 9, color: '#888', marginLeft: 4 }}>({String(r.prior_session_date).slice(0, 10)})</span>
                        )}
                      </td>
                      <td style={{ ...compact, fontWeight: 700, color: pctColor }}>
                        {pct != null && !Number.isNaN(pct)
                          ? `${pct.toFixed(2)}%`
                          : '—'}
                      </td>
                    </tr>
                  )})}
                  {mondayPwhRows.length === 0 && !mondayPwhError && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: 24, color: '#888' }}>
                        No symbols matched (check EOD data and that a Monday exists on or before today).
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </TableWrapper>
          )}
          {!mondayPwhLoading && mondayPwhRows.length > MONDAY_PWH_TABLE_PAGE_SIZE && (
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1,
                mt: 1.5,
              }}
            >
              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: 12 }}>
                {mondayRangeStart}–{mondayRangeEnd} of {mondayPwhRows.length}
              </Typography>
              <Pagination
                count={mondayPwhTotalPages}
                page={mondayPwhPage}
                onChange={(_, v) => setMondayPwhPage(v)}
                color="primary"
                size="small"
                siblingCount={1}
                boundaryCount={1}
              />
            </Box>
          )}
        </Box>
      )}

      {view === 'signals' && (
        <Box id="advisor-custom-rs-screen" sx={{ mb: 2 }}>
          {customSetupError && (
            <Alert severity="warning" onClose={() => setCustomSetupError(null)} sx={{ mb: 1.5, '& .MuiAlert-message': { fontSize: 13 } }}>
              {customSetupError}
            </Alert>
          )}
          <TableTitle style={{ fontSize: 15, marginBottom: 8, color: '#0b3d91' }}>Custom RS / MACD / PSAR screen</TableTitle>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 1.5 }}>
            <Chip
              size="small"
              label={
                customSortedRows.length === 0
                  ? '0 names'
                  : customSortedRows.length > CUSTOM_RS_TABLE_DISPLAY_LIMIT
                    ? `${customRangeStart}–${customRangeEnd} of ${customSortedRows.length} (${CUSTOM_RS_TABLE_DISPLAY_LIMIT}/page)`
                    : `${customSortedRows.length} names`
              }
              sx={{ fontWeight: 700, borderColor: '#1a3c5e', color: '#1a3c5e' }}
              variant="outlined"
            />
            <Select
              size="small"
              value={customSetupMode}
              onChange={(e) => { setCustomSetupMode(e.target.value); }}
              sx={{ minWidth: 120, fontSize: 12, bgcolor: '#fff' }}
            >
              <MenuItem value="or_signal">or_signal</MenuItem>
              <MenuItem value="strict">strict</MenuItem>
            </Select>
            <Button
              size="small"
              variant="outlined"
              disabled={customSetupLoading}
              onClick={() => loadCustomSetup(true)}
              sx={{ textTransform: 'none', fontSize: 12, borderColor: '#1a3c5e', color: '#1a3c5e' }}
            >
              Refresh
            </Button>
            <Button
              size="small"
              variant="text"
              disabled={!customSortCol}
              onClick={() => { setCustomSortCol(''); setCustomSortDir('desc'); setCustomSetupPage(1); }}
              sx={{ textTransform: 'none', fontSize: 11, color: '#666', minWidth: 0 }}
            >
              Reset sort
            </Button>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 1.5 }}>
            <Tooltip title="Select all symbols on this page of the custom screener">
              <Button
                size="small"
                variant="outlined"
                startIcon={<MdSelectAll />}
                onClick={() => {
                  const visibleSyms = customDisplayedRows.map((row) => row.symbol).filter(Boolean);
                  setCheckedSymbols((prev) => {
                    const allChecked = visibleSyms.length > 0 && visibleSyms.every((s) => prev.has(s));
                    const next = new Set(prev);
                    if (allChecked) visibleSyms.forEach((s) => next.delete(s));
                    else visibleSyms.forEach((s) => next.add(s));
                    return next;
                  });
                }}
                sx={{
                  textTransform: 'none', fontSize: 11, px: 1.5, minWidth: 0,
                  borderColor: '#1a3c5e', color: '#1a3c5e',
                  '&:hover': { bgcolor: '#e3f2fd' },
                }}
              >
                {checkedSymbols.size > 0 ? `${checkedSymbols.size} selected` : 'Select All'}
              </Button>
            </Tooltip>
            <Tooltip title={copied ? 'Copied!' : 'Copy selected symbols, or full custom screener list if none selected (TradingView CSV)'}>
              <Button
                size="small"
                variant="outlined"
                startIcon={copied ? <MdCheck /> : <MdContentCopy />}
                onClick={() => {
                  const syms = checkedSymbols.size > 0
                    ? [...checkedSymbols]
                    : customSortedRows.map((row) => row.symbol).filter(Boolean);
                  const csv = syms.map((s) => `NSE:${s}`).join(',');
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
                }}
              >
                {copied ? 'Copied!' : `Copy (${checkedSymbols.size > 0 ? checkedSymbols.size : customSortedRows.length})`}
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
              <Button
                size="small"
                onClick={() => setCheckedSymbols(new Set())}
                sx={{ textTransform: 'none', fontSize: 11, px: 1, color: '#888', minWidth: 0 }}
              >
                Clear
              </Button>
            )}
          </Box>
          {!customSetupLoading && customSortedRows.length > 0 && (
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1,
                mb: 1,
              }}
            >
              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: 12 }}>
                Custom screener: {customRangeStart}–{customRangeEnd} of {customSortedRows.length}
                {customSortedRows.length > CUSTOM_RS_TABLE_DISPLAY_LIMIT
                  ? ` (${CUSTOM_RS_TABLE_DISPLAY_LIMIT} per page)`
                  : ''}
              </Typography>
              {customSortedRows.length > CUSTOM_RS_TABLE_DISPLAY_LIMIT && (
                <Pagination
                  count={customSetupTotalPages}
                  page={customSetupPage}
                  onChange={(_, v) => setCustomSetupPage(v)}
                  color="primary"
                  size="small"
                  siblingCount={1}
                  boundaryCount={1}
                />
              )}
            </Box>
          )}
          {customSetupLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={28} /></Box>
          ) : (
            <TableWrapper>
              <Table style={{ fontSize: 12, minWidth: 1500 }}>
                <thead>
                  <tr>
                    <th style={{ ...compact, width: 30, padding: '4px', cursor: 'default' }}>
                      <Checkbox
                        size="small"
                        sx={{ p: 0, color: '#fff', '&.Mui-checked': { color: '#fff' } }}
                        checked={
                          customDisplayedRows.length > 0
                          && customDisplayedRows.every((row) => checkedSymbols.has(row.symbol))
                        }
                        indeterminate={
                          customDisplayedRows.some((row) => checkedSymbols.has(row.symbol))
                          && !customDisplayedRows.every((row) => checkedSymbols.has(row.symbol))
                        }
                        onChange={() => {
                          const visible = customDisplayedRows.map((row) => row.symbol).filter(Boolean);
                          setCheckedSymbols((prev) => {
                            const allChecked = visible.length > 0 && visible.every((sym) => prev.has(sym));
                            const next = new Set(prev);
                            if (allChecked) visible.forEach((sym) => next.delete(sym));
                            else visible.forEach((sym) => next.add(sym));
                            return next;
                          });
                        }}
                      />
                    </th>
                    {SIG_COLS.map((col) => (
                      <th
                        key={`custom-h-${col.key}`}
                        style={{
                          ...compact,
                          cursor: col.key === 'strategies' ? 'default' : 'pointer',
                          userSelect: 'none',
                          color: '#fff',
                        }}
                        onClick={() => col.key !== 'strategies' && handleCustomTableSort(col.key)}
                      >
                        {col.label}
                        {col.key !== 'strategies' && <CustomTableSortIcon col={col.key} />}
                      </th>
                    ))}
                    <th style={{ ...compact, userSelect: 'none', color: '#fff', fontWeight: 600 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                        <span
                          role="presentation"
                          onClick={() => handleCustomTableSort('rs_daily')}
                          style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                        >
                          RS D<CustomTableSortIcon col="rs_daily" />
                        </span>
                        <span style={{ opacity: 0.7 }}>/</span>
                        <span
                          role="presentation"
                          onClick={() => handleCustomTableSort('rs_weekly')}
                          style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                        >
                          W<CustomTableSortIcon col="rs_weekly" />
                        </span>
                        <span style={{ opacity: 0.7 }}>/</span>
                        <span
                          role="presentation"
                          onClick={() => handleCustomTableSort('rs_monthly')}
                          style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                        >
                          M<CustomTableSortIcon col="rs_monthly" />
                        </span>
                      </span>
                    </th>
                    <th
                      style={{ ...compact, cursor: 'pointer', userSelect: 'none', color: '#fff' }}
                      onClick={() => handleCustomTableSort('rvol')}
                    >
                      RVOL
                      <CustomTableSortIcon col="rvol" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {customDisplayedRows.map((r, i) => {
                    const sym = r.symbol;
                    const s = sym ? signalBySymbolForCustom.get(String(sym).toUpperCase()) : null;
                    const isChecked = sym && checkedSymbols.has(sym);
                    let rowBg;
                    if (isChecked) rowBg = '#e3f2fd';
                    else if (s) {
                      rowBg = s.high_conviction ? '#e8f5e9' : s.weekly_aligned ? '#f0f8ff' : s.actionable ? '#fafffe' : undefined;
                    }
                    const cmp = s?.cmp;
                    const pctEntry = s?.pct_from_entry;
                    const pctColor = pctEntry != null
                      ? (Math.abs(pctEntry) <= 2 ? '#1b5e20' : Math.abs(pctEntry) <= 5 ? '#f57f17' : '#c62828')
                      : '#888';
                    const tColor = s ? (trendColors[s.trend] || '#666') : '#888';
                    const isBull = s?.trend === 'bullish';
                    const tgtColor = isBull ? '#1b5e20' : '#c62828';
                    const slColor = isBull ? '#c62828' : '#1b5e20';
                    const tier = s?.buy_sell_tier;
                    const tierColor = tier?.startsWith('B') ? '#1b5e20' : tier?.startsWith('S') ? '#c62828' : '#666';
                    const tierBg = tier?.startsWith('B') ? '#e8f5e9' : tier?.startsWith('S') ? '#ffebee' : '#f5f5f5';
                    const wkColor = s?.weekly_trend === 'bullish' ? '#1b5e20' : s?.weekly_trend === 'bearish' ? '#c62828' : '#888';
                    const signalStrategyTags = s ? deriveStrategyTags(s) : [];
                    const customTags = customScreenerSetupChips(r);
                    const displayStrategyTags = [...signalStrategyTags, ...customTags];
                    const rvolNum = r.relative_volume != null ? Number(r.relative_volume) : null;
                    const rvolStrong = rvolNum != null && !Number.isNaN(rvolNum) && rvolNum >= 2;
                    return (
                      <tr
                        key={`custom-${sym}-${(customSetupPage - 1) * CUSTOM_RS_TABLE_DISPLAY_LIMIT + i}`}
                        style={{ background: rowBg }}
                      >
                        <td style={{ padding: '4px', textAlign: 'center' }}>
                          <Checkbox
                            size="small"
                            sx={{ p: 0 }}
                            checked={Boolean(sym && isChecked)}
                            onChange={() => {
                              if (!sym) return;
                              setCheckedSymbols((prev) => {
                                const next = new Set(prev);
                                if (next.has(sym)) next.delete(sym);
                                else next.add(sym);
                                return next;
                              });
                            }}
                          />
                        </td>
                        <td style={{ ...compact, fontWeight: 700 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            {sym}
                            <TradingViewLink symbol={sym} />
                            {s?.high_conviction && (
                              <span style={{
                                fontSize: 8, padding: '1px 4px', borderRadius: 2,
                                background: '#1b5e20', color: '#fff', fontWeight: 700, verticalAlign: 'super',
                              }}>HC</span>
                            )}
                          </span>
                        </td>
                        <td style={{ ...compact, fontWeight: 700, color: s?.conviction_score >= 100 ? '#1b5e20' : s?.conviction_score >= 80 ? '#2e7d32' : '#333' }}>
                          {s?.conviction_score != null ? s.conviction_score.toFixed(0) : '—'}
                        </td>
                        <td style={compact}>
                          {s ? (
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
                          ) : (
                            <span style={{ color: '#bbb', fontSize: 10 }}>—</span>
                          )}
                        </td>
                        <td style={compact}>
                          {tier ? (
                            <Chip label={tier} size="small" sx={{ fontSize: 10, height: 18, fontWeight: 700,
                              bgcolor: tierBg, color: tierColor, minWidth: 28 }} />
                          ) : <span style={{ color: '#ccc', fontSize: 10 }}>—</span>}
                        </td>
                        <td style={{ ...compact, color: tColor, fontWeight: 600 }}>
                          {s ? trendLabel(s.trend, s.signal_type) : '—'}
                        </td>
                        <td style={{ ...compact, minWidth: 190 }}>
                          {displayStrategyTags.length ? (
                            <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4 }}>
                              {displayStrategyTags.map((tag, ti) => (
                                <Chip
                                  key={`${sym}-${tag.label}-${ti}`}
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
                          {s?.weekly_trend ? (s.weekly_trend.charAt(0).toUpperCase() + s.weekly_trend.slice(1)) : '—'}
                          {s?.weekly_aligned && <span style={{ fontSize: 8, marginLeft: 2, color: '#1b5e20' }}>✓</span>}
                        </td>
                        <td style={{ ...compact, fontWeight: 600 }}>
                          {cmp ? fmt(cmp) : '—'}
                          {pctEntry != null && (
                            <span style={{ fontSize: 9, color: pctColor, marginLeft: 2 }}>
                              ({pctEntry > 0 ? '+' : ''}{pctEntry}%)
                            </span>
                          )}
                        </td>
                        <td style={{ ...compact, fontWeight: 600, color: '#1565c0' }}>{s?.entry_price != null ? fmt(s.entry_price) : '—'}</td>
                        <td style={{ ...compact }}>
                          {s ? (() => {
                            const trail = getTrailingState(s);
                            if (trail.effectiveStopLoss == null) return '—';
                            return (
                              <span style={{ color: trail.costExit ? '#c62828' : trail.t1Hit ? '#1565c0' : slColor, fontWeight: trail.t1Hit ? 700 : 400 }}>
                                ₹{trail.effectiveStopLoss.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                {trail.costExit ? ' (C2C Exit)' : trail.t1Hit ? ' (Trail @ Cost)' : ''}
                              </span>
                            );
                          })() : '—'}
                        </td>
                        <td style={{ ...compact, color: slColor, fontSize: 10 }}>{s?.sl_pct != null ? `${s.sl_pct}%` : '—'}</td>
                        <td style={{ ...compact, fontWeight: 600, color: tgtColor }}>{s?.target_1 != null ? fmt(s.target_1) : '—'}</td>
                        <td style={compact}>{s?.target_2 != null ? fmt(s.target_2) : '—'}</td>
                        <td style={{ ...compact, fontWeight: s?.further_scope ? 700 : 400, color: s?.further_scope ? '#2e7d32' : '#888' }}>
                          {s?.further_scope ? fmt(s.next_scope_target) : (s?.target_done ? 'Done' : '—')}
                        </td>
                        <td style={{ ...compact, fontSize: 10, maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s?.sector || '—'}</td>
                        <td style={{ ...compact, fontSize: 11, color: '#37474f' }}>
                          {[r.rs_daily_123, r.rs_weekly_52, r.rs_monthly_12].map((x) => (x != null && !Number.isNaN(Number(x)) ? Number(x).toFixed(2) : '—')).join(' / ')}
                        </td>
                        <td style={{ ...compact, fontWeight: rvolStrong ? 700 : 400, color: rvolStrong ? '#1b5e20' : '#333' }}>
                          {r.relative_volume != null ? r.relative_volume : '—'}
                        </td>
                      </tr>
                    );
                  })}
                  {customSortedRows.length === 0 && !customSetupError && (
                    <tr><td colSpan={SIG_COLS.length + 3} style={{ textAlign: 'center', padding: 24, color: '#888' }}>No symbols match this setup.</td></tr>
                  )}
                </tbody>
              </Table>
            </TableWrapper>
          )}
          {!customSetupLoading && customSortedRows.length > CUSTOM_RS_TABLE_DISPLAY_LIMIT && (
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1,
                mt: 1.5,
              }}
            >
              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: 12 }}>
                {customRangeStart}–{customRangeEnd} of {customSortedRows.length}
              </Typography>
              <Pagination
                count={customSetupTotalPages}
                page={customSetupPage}
                onChange={(_, v) => setCustomSetupPage(v)}
                color="primary"
                size="small"
                siblingCount={1}
                boundaryCount={1}
              />
            </Box>
          )}
        </Box>
      )}

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
              onChange={(e) => {
                const v = e.target.value;
                if (v === 'custom_rs_or_signal') setCustomSetupMode('or_signal');
                if (v === 'custom_rs_strict') setCustomSetupMode('strict');
                setStrategyFilter(v);
                setPage(1);
              }}
              sx={{ minWidth: 200, fontSize: 12 }}
            >
              <MenuItem value="all">All Strategies</MenuItem>
              <MenuItem value="custom_rs_or_signal">RS+EMA + (MACD W|M | PSAR | RVOL)</MenuItem>
              <MenuItem value="custom_rs_strict">Strict: RS cross + MACD W&amp;M + PSAR + RVOL</MenuItem>
              <MenuItem value="monthly_psar_macd">Monthly MACD+PSAR</MenuItem>
              <MenuItem value="macd_cross_up_weekly">Weekly MACD Cross + Red-&gt;Green Hist</MenuItem>
              <MenuItem value="macd_cross_up_monthly">Monthly MACD Cross + Red-&gt;Green Hist</MenuItem>
              <MenuItem value="vwap_cross_above">VWAP Cross Above</MenuItem>
              <MenuItem value="vwap_cross_below">VWAP Cross Below</MenuItem>
            </Select>
            <Box sx={{ display: 'flex', border: '1px solid #ccc', borderRadius: 1, overflow: 'hidden' }}>
              {[
                { val: 'all', label: `All` },
                { val: 'high', label: `High Conv (${signalStats.highConvCount})`, color: '#1b5e20', bg: '#e8f5e9' },
                { val: 'high_bull', label: `HC Bull (${signalStats.highConvBullCount})`, color: '#1b5e20', bg: '#e8f5e9' },
                { val: 'high_bear', label: `HC Bear (${signalStats.highConvBearCount})`, color: '#c62828', bg: '#ffebee' },
                { val: 'weekly', label: `Wk Aligned (${signalStats.weeklyAlignedCount})` },
                { val: 'entry_ready', label: `Entry Ready (${signalStats.entryReadyCount})`, color: '#1565c0', bg: '#e3f2fd' },
                { val: 'done', label: `Done (${signalStats.doneCount})`, color: '#6d4c41', bg: '#efebe9' },
                { val: 'actionable', label: `Actionable (${signalStats.actionableCount})` },
                { val: 'monthly_setup', label: `Monthly Setup (${monthlySetupCount})`, color: '#0d47a1', bg: '#e3f2fd' },
                { val: 'macd_weekly_cross_up', label: `MACD W↑ + Red->Green Hist (${signalStats.macdWeeklyCrossUpCount})`, color: '#2e7d32', bg: '#e8f5e9' },
                { val: 'macd_monthly_cross_up', label: `MACD M↑ + Red->Green Hist (${signalStats.macdMonthlyCrossUpCount})`, color: '#0d47a1', bg: '#e3f2fd' },
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
            <Select
              size="small"
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setPage(1);
              }}
              sx={{ minWidth: 118, fontSize: 12 }}
            >
              {SIGNAL_PAGE_SIZE_OPTIONS.map((n) => (
                <MenuItem key={n} value={n}>
                  {n === 300 ? '300 / page (max)' : `${n} / page`}
                </MenuItem>
              ))}
            </Select>
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

      {!listLoading && (view === 'signals' || view === 'alerts') && sortedData.length > 0 && (
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            mb: 1,
            px: 0.5,
          }}
        >
          <Typography component="div" variant="body2" sx={{ color: 'text.secondary', fontSize: 13 }}>
            Showing {listRangeStart}–{listRangeEnd} of {sortedData.length}
          </Typography>
          {totalPages > 1 && (
            <Pagination
              count={totalPages}
              page={safeListPage}
              onChange={(_, v) => setPage(v)}
              color="primary"
              size="small"
              siblingCount={1}
              boundaryCount={1}
            />
          )}
        </Box>
      )}

      {(view === 'signals' ? signalsLoading : alertsLoading) ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
      ) : view === 'signals' ? (
        <TableWrapper>
          <Table style={{ fontSize: 12, minWidth: 1500 }}>
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
          <Table style={{ fontSize: 12, minWidth: 980 }}>
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

      {!listLoading && (view === 'signals' || view === 'alerts') && sortedData.length > 0 && (
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            mt: 2,
            px: 0.5,
          }}
        >
          <Typography component="div" variant="body2" sx={{ color: 'text.secondary', fontSize: 13 }}>
            Showing {listRangeStart}–{listRangeEnd} of {sortedData.length}
          </Typography>
          {totalPages > 1 && (
            <Pagination
              count={totalPages}
              page={safeListPage}
              onChange={(_, v) => setPage(v)}
              color="primary"
              size="small"
              siblingCount={1}
              boundaryCount={1}
            />
          )}
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

  const portfolioRows = useMemo(() => {
    if (!result || typeof result !== 'object') return [];
    const table = Array.isArray(result?.sentiment_table) ? result.sentiment_table : [];
    const reviewList = Array.isArray(result?.stocks_requiring_review) ? result.stocks_requiring_review : [];
    const newsList = Array.isArray(result?.recent_news) ? result.recent_news : [];
    const knownStocks = new Set(
      table
        .map((r) => String(r?.stock || '').trim().toUpperCase())
        .filter(Boolean)
    );
    const reviewByStock = new Map(
      reviewList.map((r) => [
        String(r?.stock || '').toUpperCase(),
        {
          reason: String(r?.reason || '').trim(),
          focus: Array.isArray(r?.focus_areas) ? r.focus_areas.join(', ') : '',
        },
      ])
    );
    const newsByStock = new Map();
    newsList.forEach((n) => {
      const raw = String(
        n?.stock
        || n?.symbol
        || n?.for_stock
        || ''
      ).trim().toUpperCase();
      const item = {
        headline: String(n?.headline || '').trim(),
        implication: String(n?.implication || '').trim(),
      };
      if (!item.headline && !item.implication) return;

      // Primary mapping via explicit stock/symbol fields.
      if (raw && knownStocks.has(raw)) {
        const arr = newsByStock.get(raw) || [];
        arr.push(item);
        newsByStock.set(raw, arr);
        return;
      }

      // Secondary mapping: infer stock from headline/implication mention.
      const blob = `${item.headline} ${item.implication}`.toUpperCase();
      knownStocks.forEach((sym) => {
        if (!sym) return;
        const tokenMatch =
          blob.includes(` ${sym} `)
          || blob.startsWith(`${sym} `)
          || blob.endsWith(` ${sym}`)
          || blob.includes(`(${sym})`)
          || blob.includes(`-${sym}`)
          || blob.includes(`${sym}-`);
        if (tokenMatch) {
          const arr = newsByStock.get(sym) || [];
          arr.push(item);
          newsByStock.set(sym, arr);
        }
      });
    });

    return table.map((row) => {
      const stock = String(row?.stock || '').trim().toUpperCase();
      const sentiment = String(row?.sentiment || 'Neutral').trim();
      const expectation = String(row?.analyst_expectation || '').trim();
      const review = reviewByStock.get(stock);
      const stockNews = (newsByStock.get(stock) || []).slice(0, 5);
      return {
        stock: stock || '—',
        sentiment: sentiment || '—',
        expectation: expectation || '',
        reviewReason: review?.reason || '',
        reviewFocus: review?.focus ? `Focus: ${review.focus}` : '',
        newsPoints: stockNews,
      };
    });
  }, [result]);

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
        <Box>
          {portfolioRows.length > 0 ? (
            <TableWrapper>
              <Table style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={compact}>Stock Name</th>
                    <th style={compact}>Sentiment Analysis</th>
                    <th style={compact}>Overall Analysis</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolioRows.map((row) => (
                    <tr key={row.stock}>
                      <td style={{ ...compact, fontWeight: 700 }}>{row.stock}</td>
                      <td style={compact}>{row.sentiment}</td>
                      <td style={{ ...compact, whiteSpace: 'normal', minWidth: 360 }}>
                        {[row.expectation, row.reviewReason, row.reviewFocus].filter(Boolean).join(' | ') || '—'}
                        {row.newsPoints?.length ? (
                          <Box component="ul" sx={{ mb: 0, mt: 0.6, pl: 2 }}>
                            {row.newsPoints.map((n, idx) => (
                              <Box component="li" key={`${row.stock}-news-${idx}`} sx={{ mb: 0.25 }}>
                                {n.headline || '—'}
                                {n.implication ? ` — ${n.implication}` : ''}
                              </Box>
                            ))}
                          </Box>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrapper>
          ) : (
            <Box sx={{ bgcolor: '#f8f9fa', p: 2, borderRadius: 2, fontFamily: 'monospace', fontSize: 12, maxHeight: 500, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
              {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
            </Box>
          )}
          {result?.summary ? (
            <Box sx={{ mt: 1.2, fontSize: 12, color: '#444', lineHeight: 1.5 }}>
              <b>Summary:</b> {String(result.summary)}
            </Box>
          ) : null}
        </Box>
      )}
    </Box>
  );
}

export default FinancialAdvisorPage;
