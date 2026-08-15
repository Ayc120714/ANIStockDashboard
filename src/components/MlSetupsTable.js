import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { TableTitle, TableWrapper, Table } from '../pages/SectorOutlook.styles';
import { Box, Button, Chip, CircularProgress, MenuItem, Select, Typography } from '@mui/material';
import Pagination from '@mui/material/Pagination';
import { FaSort, FaSortDown, FaSortUp } from 'react-icons/fa';
import { fetchMlSetups } from '../api/advisor';
import { SymbolWithTradingView, symbolCellTdStyle, buildTradingViewSymbolsCsv } from './TradingViewLink';
import { formatAlertTimeIST } from '../utils/alertInboxUtils';
import { readPageCache, writePageCache } from '../utils/pageDataCache';
import { runLiveMarketPageMountPoll } from '../utils/screenPageLoader';
import {
  ensureMlSetupRows,
  formatMlSetupType,
  mlSetupDirectionLabel,
  mlSetupsRowsAndMetaFromCache,
  normalizeMlSetupsPayload,
  symbolsFromMlSetupRows,
} from '../utils/mlSetupsAdvisor';

const POLL_MS = 30 * 1000;
const PAGE_SIZE = 25;
const CACHE_KEY = 'advisor_ml_setups_v3';
const compact = { fontSize: 12, padding: '4px 6px', whiteSpace: 'nowrap' };
const symbolTdStyle = symbolCellTdStyle(compact);

const COLS = [
  { key: 'ml_score', label: 'ML', numeric: true },
  { key: 'symbol', label: 'Symbol' },
  { key: 'alert_type', label: 'Setup' },
  { key: 'direction', label: 'Side' },
  { key: 'live_price', label: 'Live', numeric: true },
  { key: 'last_5m_close', label: 'Last 5m', numeric: true },
  { key: 'rsi14', label: 'RSI', numeric: true },
  { key: 'vol_ratio', label: 'RVOL', numeric: true },
  { key: 'rs_5d', label: 'RS 5d', numeric: true },
  { key: 'aligned', label: 'Aligned' },
];

const fmtNum = (v, digits = 2) => {
  if (v == null || v === '' || Number.isNaN(Number(v))) return '—';
  return Number(v).toLocaleString('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

const fmtPct = (v) => {
  if (v == null || Number.isNaN(Number(v))) return '—';
  const n = Number(v) * 100;
  if (!Number.isFinite(n)) return '—';
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;
};

const fmtScore = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : '—';
};

class MlSetupsTabGuard extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <Typography color="error" variant="body2" sx={{ py: 2 }}>
          ML Setups failed to render. Refresh the Advisor page.
        </Typography>
      );
    }
    return this.props.children;
  }
}

function MlSetupsTableInner() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({
    ready_for_open: false,
    live_enabled: false,
    feature_symbols: 0,
    high_conviction: 0,
    session_date: '',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [setupType, setSetupType] = useState('');
  const [side, setSide] = useState('');
  const [page, setPage] = useState(1);
  const [sortCol, setSortCol] = useState('ml_score');
  const [sortDir, setSortDir] = useState('desc');

  const load = useCallback(async ({ silent = false, forceNetwork = false } = {}) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      if (!forceNetwork) {
        const cached = readPageCache(CACHE_KEY);
        const hydrated = mlSetupsRowsAndMetaFromCache(cached);
        if (hydrated.rows.length) {
          setRows(hydrated.rows);
          setMeta((prev) => ({ ...prev, ...hydrated.meta }));
          if (!silent) setLoading(false);
        }
      }
      const payload = await fetchMlSetups({
        min_score: 0.55,
        setup_type: setupType,
        side,
        limit: 200,
      });
      const normalized = normalizeMlSetupsPayload(payload);
      const nextRows = ensureMlSetupRows(normalized.data);
      setRows(nextRows);
      const nextMeta = {
        ready_for_open: normalized.ready_for_open,
        live_enabled: normalized.live_enabled,
        feature_symbols: normalized.feature_symbols,
        high_conviction: normalized.high_conviction,
        total_scored: normalized.total_scored,
        session_date: normalized.session_date,
        checkpoint: normalized.checkpoint,
        metrics: normalized.metrics,
      };
      setMeta(nextMeta);
      writePageCache(CACHE_KEY, { data: nextRows, meta: nextMeta });
    } catch (e) {
      setError(String(e?.message || 'Could not load ML setups'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [setupType, side]);

  useEffect(() => {
    let cleanup;
    runLiveMarketPageMountPoll({
      load,
      liveIntervalMs: POLL_MS,
      onCleanup: (fn) => { cleanup = fn; },
    });
    return () => { if (cleanup) cleanup(); };
  }, [load]);

  const safeRows = ensureMlSetupRows(rows);

  const sorted = useMemo(() => {
    const list = [...safeRows];
    const mul = sortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      if (sortCol === 'symbol' || sortCol === 'alert_type' || sortCol === 'direction') {
        const sa = String(a[sortCol] || a.alert_type || '');
        const sb = String(b[sortCol] || b.alert_type || '');
        return mul * sa.localeCompare(sb);
      }
      if (sortCol === 'aligned') {
        return mul * (Number(Boolean(a.aligned)) - Number(Boolean(b.aligned)));
      }
      const na = Number(a[sortCol]);
      const nb = Number(b[sortCol]);
      const av = Number.isFinite(na) ? na : -Infinity;
      const bv = Number.isFinite(nb) ? nb : -Infinity;
      return mul * (av - bv);
    });
    return list;
  }, [safeRows, sortCol, sortDir]);

  const csvSymbols = useMemo(() => symbolsFromMlSetupRows(sorted), [sorted]);

  const handleCopyCsv = async () => {
    const csv = buildTradingViewSymbolsCsv(csvSymbols);
    if (!csv) return;
    try {
      await navigator.clipboard.writeText(csv);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Could not copy CSV (use HTTPS or allow clipboard access)');
    }
  };

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const paged = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const aucRaw = Number(meta?.metrics?.roc_auc);
  const auc = Number.isFinite(aucRaw) ? aucRaw : null;

  const toggleSort = (key) => {
    if (sortCol === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortCol(key);
      setSortDir(key === 'symbol' || key === 'alert_type' ? 'asc' : 'desc');
    }
    setPage(1);
  };

  const setupOptions = useMemo(() => {
    const types = new Set(safeRows.map((r) => r.alert_type).filter(Boolean));
    return [...types].sort();
  }, [safeRows]);

  return (
    <Box id="advisor-ml-setups" sx={{ mb: 2 }}>
      <TableTitle style={{ fontSize: 15, marginBottom: 8, color: '#0b3d91' }}>
        ML Setups
      </TableTitle>
      <Typography variant="body2" sx={{ mb: 1.5, color: 'text.secondary', maxWidth: 760 }}>
        Ranked live-market setups using complete quotes (last 5-minute bar + live price).
        Updates every 5 minutes in session; model retrains at EOD. Only score ≥ 0.55 is shown.
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 1.5 }}>
        <Chip
          size="small"
          color={meta.live_enabled ? 'success' : meta.ready_for_open ? 'success' : 'warning'}
          label={meta.live_enabled ? 'Live market on' : meta.ready_for_open ? 'Ready before 9 AM' : 'Warming data'}
        />
        <Chip size="small" variant="outlined" label={`${meta.high_conviction || safeRows.length} high conviction`} />
        <Chip size="small" variant="outlined" label={`${meta.feature_symbols || 0} symbols with live features`} />
        {meta.session_date ? (
          <Chip size="small" variant="outlined" label={`Session ${meta.session_date}`} />
        ) : null}
        {auc != null ? (
          <Chip size="small" variant="outlined" label={`AUC ${auc.toFixed(2)}`} />
        ) : null}
        <Select
          size="small"
          value={setupType}
          onChange={(e) => { setSetupType(e.target.value); setPage(1); }}
          displayEmpty
          sx={{ minWidth: 180, fontSize: 12, height: 32 }}
        >
          <MenuItem value="">All setups</MenuItem>
          {setupOptions.map((t) => (
            <MenuItem key={t} value={t}>{formatMlSetupType(t)}</MenuItem>
          ))}
        </Select>
        <Select
          size="small"
          value={side}
          onChange={(e) => { setSide(e.target.value); setPage(1); }}
          displayEmpty
          sx={{ minWidth: 110, fontSize: 12, height: 32 }}
        >
          <MenuItem value="">Both sides</MenuItem>
          <MenuItem value="1">Long</MenuItem>
          <MenuItem value="-1">Short</MenuItem>
        </Select>
        <Button size="small" variant="outlined" onClick={() => load({ forceNetwork: true })}>
          Refresh
        </Button>
        <Button
          size="small"
          variant="contained"
          disabled={!csvSymbols.length}
          onClick={handleCopyCsv}
          sx={{ textTransform: 'none', fontSize: 12 }}
        >
          {copied ? 'Copied!' : `Copy CSV (${csvSymbols.length})`}
        </Button>
      </Box>
      {loading && !safeRows.length ? <CircularProgress size={22} /> : null}
      {error ? <Typography color="error" variant="body2">{error}</Typography> : null}
      {!loading && !error && !safeRows.length ? (
        <Typography variant="body2" color="text.secondary">No high-conviction setups yet. Data is prepared at 08:50 IST.</Typography>
      ) : null}
      {safeRows.length ? (
        <>
          <TableWrapper>
            <Table>
              <thead>
                <tr>
                  {COLS.map((col) => (
                    <th key={col.key} style={{ ...compact, cursor: 'pointer' }} onClick={() => toggleSort(col.key)}>
                      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                        {col.label}
                        {sortCol === col.key ? (sortDir === 'asc' ? <FaSortUp /> : <FaSortDown />) : <FaSort />}
                      </Box>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map((row, idx) => (
                  <tr key={`${row.symbol}-${row.alert_type}-${idx}`}>
                    <td style={compact}>{fmtScore(row.ml_score)}</td>
                    <td style={symbolTdStyle}>
                      <SymbolWithTradingView symbol={row.symbol} />
                    </td>
                    <td style={compact}>{formatMlSetupType(row.alert_type)}</td>
                    <td style={compact}>{mlSetupDirectionLabel(row)}</td>
                    <td style={compact}>{fmtNum(row.live_price)}</td>
                    <td style={compact}>{fmtNum(row.last_5m_close)}</td>
                    <td style={compact}>{fmtNum(row.rsi14, 0)}</td>
                    <td style={compact}>{fmtNum(row.vol_ratio, 2)}</td>
                    <td style={compact}>{fmtPct(row.rs_5d)}</td>
                    <td style={compact}>{row.aligned ? 'Yes' : 'Check'}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrapper>
          {pageCount > 1 ? (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
              <Pagination count={pageCount} page={safePage} onChange={(_, p) => setPage(p)} size="small" />
            </Box>
          ) : null}
          {meta.checkpoint ? (
            <Typography variant="caption" color="text.secondary">
              Checkpoint {meta.checkpoint}
              {meta.session_date ? ` · ${formatAlertTimeIST(new Date().toISOString())}` : ''}
            </Typography>
          ) : null}
        </>
      ) : null}
    </Box>
  );
}

export default function MlSetupsTable() {
  return (
    <MlSetupsTabGuard>
      <MlSetupsTableInner />
    </MlSetupsTabGuard>
  );
}
