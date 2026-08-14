import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { TableTitle, TableWrapper, Table } from '../pages/SectorOutlook.styles';
import { Box, Button, Chip, CircularProgress, MenuItem, Select, Typography } from '@mui/material';
import Pagination from '@mui/material/Pagination';
import { FaSort, FaSortDown, FaSortUp } from 'react-icons/fa';
import { fetchMlSetups } from '../api/advisor';
import { SymbolWithTradingView, symbolCellTdStyle } from './TradingViewLink';
import { formatAlertTimeIST } from '../utils/alertInboxUtils';
import { readPageCache, writePageCache } from '../utils/pageDataCache';
import { runLiveMarketPageMountPoll } from '../utils/screenPageLoader';
import {
  formatMlSetupType,
  mlSetupDirectionLabel,
  normalizeMlSetupsPayload,
} from '../utils/mlSetupsAdvisor';

const POLL_MS = 60 * 1000;
const PAGE_SIZE = 25;
const CACHE_KEY = 'advisor_ml_setups_v1';
const compact = { fontSize: 12, padding: '4px 6px', whiteSpace: 'nowrap' };

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
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;
};

export default function MlSetupsTable() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ ready_for_open: false, feature_symbols: 0, high_conviction: 0, session_date: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
        if (cached?.data?.length) {
          setRows(cached.data);
          setMeta(cached.meta || {});
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
      setRows(normalized.data);
      const nextMeta = {
        ready_for_open: normalized.ready_for_open,
        feature_symbols: normalized.feature_symbols,
        high_conviction: normalized.high_conviction,
        total_scored: normalized.total_scored,
        session_date: normalized.session_date,
        checkpoint: normalized.checkpoint,
        metrics: normalized.metrics,
      };
      setMeta(nextMeta);
      writePageCache(CACHE_KEY, { data: normalized.data, meta: nextMeta });
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

  const sorted = useMemo(() => {
    const list = [...rows];
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
  }, [rows, sortCol, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const auc = meta?.metrics?.roc_auc;

  const toggleSort = (key) => {
    if (sortCol === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortCol(key);
      setSortDir(key === 'symbol' || key === 'alert_type' ? 'asc' : 'desc');
    }
    setPage(1);
  };

  const setupOptions = useMemo(() => {
    const types = new Set(rows.map((r) => r.alert_type).filter(Boolean));
    return [...types].sort();
  }, [rows]);

  return (
    <Box id="advisor-ml-setups" sx={{ mb: 2 }}>
      <TableTitle style={{ fontSize: 15, marginBottom: 8, color: '#0b3d91' }}>
        ML Setups
      </TableTitle>
      <Typography variant="body2" sx={{ mb: 1.5, color: 'text.secondary', maxWidth: 760 }}>
        Ranked live-market setups using complete quotes (last 5-minute bar + live price).
        Model retrains at EOD; data is warmed before 09:00 IST. Only score ≥ 0.55 is shown.
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 1.5 }}>
        <Chip
          size="small"
          color={meta.ready_for_open ? 'success' : 'warning'}
          label={meta.ready_for_open ? 'Ready before 9 AM' : 'Warming data'}
        />
        <Chip size="small" variant="outlined" label={`${meta.high_conviction || rows.length} high conviction`} />
        <Chip size="small" variant="outlined" label={`${meta.feature_symbols || 0} symbols with live features`} />
        {meta.session_date ? (
          <Chip size="small" variant="outlined" label={`Session ${meta.session_date}`} />
        ) : null}
        {auc != null ? (
          <Chip size="small" variant="outlined" label={`AUC ${Number(auc).toFixed(2)}`} />
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
      </Box>
      {loading && !rows.length ? <CircularProgress size={22} /> : null}
      {error ? <Typography color="error" variant="body2">{error}</Typography> : null}
      {!loading && !error && !rows.length ? (
        <Typography variant="body2" color="text.secondary">No high-conviction setups yet. Data is prepared at 08:50 IST.</Typography>
      ) : null}
      {rows.length ? (
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
                    <td style={compact}>{Number(row.ml_score).toFixed(2)}</td>
                    <td style={symbolCellTdStyle}>
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
              <Pagination count={pageCount} page={page} onChange={(_, p) => setPage(p)} size="small" />
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
