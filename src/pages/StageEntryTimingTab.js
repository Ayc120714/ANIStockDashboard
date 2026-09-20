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
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import Pagination from '@mui/material/Pagination';
import { FaSort, FaSortDown, FaSortUp } from 'react-icons/fa';
import { MdRefresh } from 'react-icons/md';
import { TableSection, TableTitle, TableWrapper, Table } from './SectorOutlook.styles';
import { fetchStageEntryTiming } from '../api/advisor';
import { SymbolWithTradingView, symbolCellTdStyle, buildTradingViewSymbolsCsv } from '../components/TradingViewLink';
import { LIVE_PAGE_CACHE_KEYS } from '../utils/livePageCacheKeys';
import { readPageCache, writePageCache } from '../utils/pageDataCache';
import {
  STAGE_ENTRY_TIMING_OPTIONS,
  WEEKLY_CONFIRM_LABELS,
  entryTimingChipColor,
  formatEntryTiming,
  formatMinerviniScore,
  formatRsCross,
  formatStageLabel,
  formatConfirmTimeframes,
  weeklyConfirmPassedCount,
} from '../utils/stageEntryTiming';

const compact = { fontSize: 12, padding: '4px 6px', whiteSpace: 'nowrap' };
const PAGE_SIZE = 20;

const COLS = [
  { key: 'symbol', label: 'Symbol' },
  { key: 'weinstein_stage', label: 'Stage' },
  { key: 'minervini_score', label: 'Template' },
  { key: 'rs_rating', label: 'RS (prev→now)' },
  { key: 'confirm_timeframes', label: 'TF confirm' },
  { key: 'entry_timing', label: 'Entry timing' },
  { key: 'close', label: 'Close', numeric: true },
  { key: 'sma50', label: '50-DMA', numeric: true },
  { key: 'sma150', label: '150-DMA', numeric: true },
  { key: 'sma200', label: '200-DMA', numeric: true },
  { key: 'pct_from_high', label: '% vs H', numeric: true },
  { key: 'weekly_rvol', label: 'Wk RVol', numeric: true },
  { key: 'volume_ratio', label: 'Vol×', numeric: true },
  { key: 'sector', label: 'Sector' },
];

const fmtPx = (v) => {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const fmtPct = (v) => {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return `${Number(v).toFixed(1)}%`;
};

const fmtNum = (v, d = 2) => {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return Number(v).toFixed(d);
};

function StageEntryTimingTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [asOf, setAsOf] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [timingFilter, setTimingFilter] = useState('');
  const [requireRs70, setRequireRs70] = useState(false);
  const [rsCrossAbove70, setRsCrossAbove70] = useState(false);
  const [mtfConfirm, setMtfConfirm] = useState(true);
  const [minTemplate, setMinTemplate] = useState(6);
  const [sortConfig, setSortConfig] = useState({ key: 'minervini_score', ascending: false });
  const [copied, setCopied] = useState(false);

  const load = useCallback(async ({ refresh = false } = {}) => {
    const cacheKey = `${LIVE_PAGE_CACHE_KEYS.stageEntryTiming}_mtf${mtfConfirm ? 1 : 0}_rs${rsCrossAbove70 ? 1 : 0}`;
    if (!refresh) {
      const cached = readPageCache(cacheKey);
      if (Array.isArray(cached?.data) && cached.data.length) {
        setRows(cached.data);
        setLoading(false);
      } else {
        setLoading(true);
      }
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const res = await fetchStageEntryTiming({
        limit: 300,
        symbol_limit: 800,
        min_template_score: minTemplate,
        require_rs_70: requireRs70,
        rs_cross_above_70: rsCrossAbove70,
        require_mtf_confirm: mtfConfirm,
        entry_timing: timingFilter || undefined,
        refresh,
        cache_ttl_sec: 180,
      });
      const data = Array.isArray(res?.data) ? res.data : [];
      writePageCache(cacheKey, data);
      setRows(data);
      setAsOf(res?.as_of || null);
      setPage(1);
    } catch (e) {
      setError(e?.message || 'Failed to load Stage Analysis.');
    } finally {
      setLoading(false);
    }
  }, [minTemplate, requireRs70, rsCrossAbove70, mtfConfirm, timingFilter]);

  useEffect(() => {
    load({ refresh: false });
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows;
    if (q) {
      list = list.filter((r) => {
        const hay = `${r.symbol || ''} ${r.sector || ''} ${r.entry_timing || ''} ${r.stage_label || ''}`.toLowerCase();
        return hay.includes(q);
      });
    }
    const { key, ascending } = sortConfig;
    if (!key) return list;
    return [...list].sort((a, b) => {
      const av = a?.[key];
      const bv = b?.[key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') {
        return ascending ? av - bv : bv - av;
      }
      return ascending ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [rows, search, sortConfig]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleCopyCsv = async () => {
    const csv = buildTradingViewSymbolsCsv(filtered.map((r) => r.symbol));
    if (!csv) return;
    try {
      await navigator.clipboard.writeText(csv);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Could not copy CSV (use HTTPS or allow clipboard access)');
    }
  };

  const requestSort = (key) => {
    setSortConfig((prev) => (
      prev.key === key
        ? { key, ascending: !prev.ascending }
        : { key, ascending: key === 'symbol' || key === 'sector' }
    ));
  };

  const sortIcon = (key) => {
    if (sortConfig.key !== key) return <FaSort size={10} style={{ opacity: 0.35 }} />;
    return sortConfig.ascending ? <FaSortUp size={10} /> : <FaSortDown size={10} />;
  };

  return (
    <TableSection style={{ marginTop: 0 }}>
      <Box mb={1.5}>
        <Typography variant="h6" sx={{ color: '#1565c0', fontWeight: 700, mb: 0.5 }}>
          Stage Analysis & Entry Timing
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          One list for all formats: Stage 2 / Minervini + Chartink PSAR confirm on Daily, Weekly,
          or Monthly (same 4 conditions). Market Cap &gt; 2000 Cr.
          {asOf ? ` · as of ${String(asOf).replace('T', ' ').slice(0, 19)} IST` : ''}
        </Typography>
        <Alert severity="info" sx={{ py: 0.5, mb: 1.5, fontSize: 12 }}>
          TF confirm (any of D/W/M) = Close crossed above PSAR(0.02) · Close &gt; prior Close
          · 2-bars-ago Close &lt; 3-bars-ago Close · Vol/EMA20 rising · MCap &gt; 2000.
          Optional: RS↑70 + other Minervini setup.
        </Alert>
      </Box>

      <Box display="flex" flexWrap="wrap" gap={1.5} alignItems="center" mb={1.5}>
        <TextField
          select
          size="small"
          label="Entry timing"
          value={timingFilter}
          onChange={(e) => setTimingFilter(e.target.value)}
          sx={{ minWidth: 200 }}
        >
          {STAGE_ENTRY_TIMING_OPTIONS.map((o) => (
            <MenuItem key={o.id || 'all'} value={o.id}>{o.label}</MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Min template"
          value={minTemplate}
          onChange={(e) => setMinTemplate(Number(e.target.value))}
          sx={{ minWidth: 120 }}
        >
          {[5, 6, 7, 8].map((n) => (
            <MenuItem key={n} value={n}>{n}/8+</MenuItem>
          ))}
        </TextField>
        <FormControlLabel
          control={(
            <Switch
              size="small"
              checked={mtfConfirm}
              onChange={(e) => setMtfConfirm(e.target.checked)}
            />
          )}
          label="PSAR confirm (D/W/M)"
        />
        <FormControlLabel
          control={(
            <Switch
              size="small"
              checked={rsCrossAbove70}
              onChange={(e) => setRsCrossAbove70(e.target.checked)}
            />
          )}
          label="RS just crossed 70 + other setup"
        />
        <FormControlLabel
          control={(
            <Switch
              size="small"
              checked={requireRs70}
              onChange={(e) => setRequireRs70(e.target.checked)}
              disabled={rsCrossAbove70}
            />
          )}
          label="RS ≥70 only"
        />
        <TextField
          size="small"
          placeholder="Search symbol / sector…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          sx={{ minWidth: 200 }}
        />
        <Button
          size="small"
          variant="outlined"
          startIcon={<MdRefresh />}
          onClick={() => load({ refresh: true })}
          disabled={loading}
        >
          Refresh
        </Button>
        <Button
          size="small"
          variant="contained"
          disabled={!filtered.length || loading}
          onClick={handleCopyCsv}
          sx={{ textTransform: 'none', fontSize: 12 }}
        >
          {copied ? 'Copied!' : `Copy CSV (${filtered.length})`}
        </Button>
      </Box>

      {loading && rows.length === 0 ? (
        <Box display="flex" flexDirection="column" alignItems="center" py={6} gap={1}>
          <CircularProgress />
          <Typography color="text.secondary">Scanning Stage 2 / Minervini universe…</Typography>
        </Box>
      ) : error ? (
        <Typography color="error" sx={{ py: 2 }}>{error}</Typography>
      ) : (
        <>
          <TableTitle>
            {mtfConfirm ? 'PSAR confirm D/W/M' : 'Stage 2'}
            {rsCrossAbove70 ? ' · RS↑70' : ''}
            {' · '}
            {filtered.length} stock{filtered.length === 1 ? '' : 's'}
            {loading ? ' · refreshing…' : ''}
          </TableTitle>
          <TableWrapper>
            <Table>
              <thead>
                <tr>
                  <th>#</th>
                  {COLS.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => requestSort(col.key)}
                      style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      {col.label} {sortIcon(col.key)}
                    </th>
                  ))}
                  <th>Checklist</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={COLS.length + 2} style={{ textAlign: 'center', padding: 24 }}>
                      No Stage 2 setups match the current filters.
                    </td>
                  </tr>
                ) : pageRows.map((row, idx) => {
                  const chip = entryTimingChipColor(row.entry_timing);
                  const cl = row.checklist || {};
                  const wk = row.weekly_confirm || {};
                  const wkTip = Object.entries(WEEKLY_CONFIRM_LABELS)
                    .map(([k, label]) => `${label}: ${wk[k] ? 'Pass' : 'Fail'}`)
                    .join(' · ');
                  return (
                    <tr key={row.symbol}>
                      <td style={compact}>{(page - 1) * PAGE_SIZE + idx + 1}</td>
                      <td style={symbolCellTdStyle(compact, 120)}>
                        <SymbolWithTradingView symbol={row.symbol} />
                      </td>
                      <td style={compact}>
                        <Tooltip title={formatStageLabel(row.weinstein_stage, row.stage_label)}>
                          <span>{row.weinstein_stage || '—'}</span>
                        </Tooltip>
                      </td>
                      <td style={compact}>
                        <Tooltip
                          title={Object.entries(row.minervini_pass || {})
                            .map(([k, v]) => `${k}: ${v ? 'Pass' : 'Fail'}`)
                            .join(' · ') || ''}
                        >
                          <span>{formatMinerviniScore(row.minervini_score)}</span>
                        </Tooltip>
                      </td>
                      <td style={{
                        ...compact,
                        color: row.rs_just_crossed_70 ? '#1b5e20' : (row.rs_rating != null && row.rs_rating >= 70 ? '#2e7d32' : '#c62828'),
                        fontWeight: 600,
                      }}
                      >
                        <Tooltip title={row.rs_just_crossed_70 ? 'RS just crossed above 70' : 'RS rating'}>
                          <span>{formatRsCross(row)}</span>
                        </Tooltip>
                      </td>
                      <td style={compact}>
                        <Tooltip title={wkTip || 'TF confirm (Daily / Weekly / Monthly)'}>
                          <Chip
                            size="small"
                            label={row.mtf_confirm_pass ? formatConfirmTimeframes(row) : `${weeklyConfirmPassedCount(row)}/4`}
                            color={row.mtf_confirm_pass ? 'success' : 'default'}
                            sx={{ height: 22, fontSize: 11, fontWeight: 600 }}
                          />
                        </Tooltip>
                      </td>
                      <td style={compact}>
                        <Chip
                          size="small"
                          label={formatEntryTiming(row.entry_timing)}
                          sx={{ ...chip, fontWeight: 600, fontSize: 11, height: 22 }}
                        />
                      </td>
                      <td style={compact}>{fmtPx(row.close)}</td>
                      <td style={compact}>{fmtPx(row.sma50)}</td>
                      <td style={compact}>{fmtPx(row.sma150)}</td>
                      <td style={compact}>{fmtPx(row.sma200)}</td>
                      <td style={compact}>{fmtPct(row.pct_from_high)}</td>
                      <td style={compact}>
                        {row.weekly_rvol != null && row.weekly_rvol_prev != null
                          ? `${fmtNum(row.weekly_rvol_prev, 2)}→${fmtNum(row.weekly_rvol, 2)}`
                          : fmtNum(row.weekly_rvol, 2)}
                      </td>
                      <td style={compact}>{fmtNum(row.volume_ratio, 2)}</td>
                      <td style={compact}>{row.sector || '—'}</td>
                      <td style={compact}>
                        <Box display="flex" gap={0.4} flexWrap="wrap">
                          <Chip size="small" label="S2" color={cl.stage2_intact ? 'success' : 'default'} sx={{ height: 20, fontSize: 10 }} />
                          <Chip size="small" label="D" color={cl.confirm_1d || (row.confirm_timeframes || []).includes('1d') ? 'success' : 'default'} sx={{ height: 20, fontSize: 10 }} />
                          <Chip size="small" label="W" color={cl.confirm_1w || (row.confirm_timeframes || []).includes('1w') ? 'success' : 'default'} sx={{ height: 20, fontSize: 10 }} />
                          <Chip size="small" label="M" color={cl.confirm_1m || (row.confirm_timeframes || []).includes('1m') ? 'success' : 'default'} sx={{ height: 20, fontSize: 10 }} />
                          <Chip size="small" label="RS↑70" color={cl.rs_just_crossed_70 || row.rs_just_crossed_70 ? 'success' : 'default'} sx={{ height: 20, fontSize: 10 }} />
                          <Chip size="small" label="Setup" color={cl.other_setup_pass || row.other_setup_pass ? 'success' : 'default'} sx={{ height: 20, fontSize: 10 }} />
                        </Box>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrapper>
          <Box display="flex" justifyContent="center" mt={2}>
            <Pagination count={pageCount} page={page} onChange={(_, p) => setPage(p)} color="primary" />
          </Box>
        </>
      )}
    </TableSection>
  );
}

export default StageEntryTimingTab;
