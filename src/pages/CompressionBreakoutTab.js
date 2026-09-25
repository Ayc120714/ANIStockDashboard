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
import { TableSection, TableWrapper, Table } from './SectorOutlook.styles';
import { fetchCompressionBreakout, fetchCupSixty } from '../api/advisor';
import { SymbolWithTradingView, symbolCellTdStyle, buildTradingViewSymbolsCsv } from '../components/TradingViewLink';
import { LIVE_PAGE_CACHE_KEYS } from '../utils/livePageCacheKeys';
import { readPageCache, writePageCache } from '../utils/pageDataCache';
import {
  CHECKLIST_LABELS,
  COMPRESSION_BREAKOUT_PHASES,
  COMPRESSION_BREAKOUT_TIMEFRAMES,
  formatEvidenceScore,
  formatPhaseLabel,
  phaseChipColor,
} from '../utils/compressionBreakout';

const compact = { fontSize: 12, padding: '4px 6px', whiteSpace: 'nowrap' };
const PAGE_SIZE = 20;

const COLS = [
  { key: 'symbol', label: 'Symbol' },
  { key: 'timeframe', label: 'TF' },
  { key: 'phase', label: 'Phase' },
  { key: 'evidence_score', label: 'Evidence' },
  { key: 'close', label: 'Close', numeric: true },
  { key: 'breakout_level', label: 'Level', numeric: true },
  { key: 'stop_hint', label: 'Stop hint', numeric: true },
  { key: 'bars_since_breakout', label: 'Bars since' },
  { key: 'breakout_volume_ratio', label: 'Vol× BO', numeric: true },
  { key: 'retest_volume_ratio', label: 'Vol× RT', numeric: true },
  { key: 'compression_atr_ratio', label: 'ATR contr.', numeric: true },
  { key: 'sector', label: 'Sector' },
];

const fmtPx = (v) => {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const fmtNum = (v, d = 2) => {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return Number(v).toFixed(d);
};

function ChecklistDots({ checklist }) {
  if (!checklist || typeof checklist !== 'object') return '—';
  return (
    <Box component="span" sx={{ display: 'inline-flex', gap: 0.35, flexWrap: 'wrap' }}>
      {Object.entries(CHECKLIST_LABELS).map(([key, label]) => {
        const ok = Boolean(checklist[key]);
        return (
          <Tooltip key={key} title={label} arrow>
            <Box
              component="span"
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: ok ? '#2e7d32' : '#cfd8dc',
                display: 'inline-block',
              }}
            />
          </Tooltip>
        );
      })}
    </Box>
  );
}

function CompressionBreakoutTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [asOf, setAsOf] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [timeframe, setTimeframe] = useState('all');
  const [phaseFilter, setPhaseFilter] = useState('');
  const [includeCompression, setIncludeCompression] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'evidence_score', ascending: false });
  const [copied, setCopied] = useState(false);

  const load = useCallback(async ({ refresh = false } = {}) => {
    const cacheKey = `${LIVE_PAGE_CACHE_KEYS.compressionBreakout(timeframe)}_${phaseFilter || 'all'}_${includeCompression ? 'c1' : 'c0'}`;
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
      const res = phaseFilter === 'cup60'
        ? await fetchCupSixty({
          timeframe,
          limit: 200,
          symbol_limit: 800,
          refresh,
          cache_ttl_sec: 180,
        })
        : await fetchCompressionBreakout({
          timeframe,
          limit: 300,
          symbol_limit: 800,
          phase: phaseFilter || undefined,
          include_compression: includeCompression || phaseFilter === 'compression',
          refresh,
          cache_ttl_sec: 180,
        });
      const data = Array.isArray(res?.data) ? res.data : [];
      writePageCache(cacheKey, data);
      setRows(data);
      setAsOf(res?.as_of || null);
      setPage(1);
    } catch (e) {
      setError(e?.message || 'Failed to load Compression Breakout setups.');
    } finally {
      setLoading(false);
    }
  }, [timeframe, phaseFilter, includeCompression]);

  useEffect(() => {
    load({ refresh: false });
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows;
    if (q) {
      list = list.filter((r) => {
        const hay = `${r.symbol || ''} ${r.sector || ''} ${r.phase || ''} ${r.phase_label || ''}`.toLowerCase();
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
        : { key, ascending: key === 'symbol' || key === 'sector' || key === 'phase' }
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
          Compression → Breakout → Retest
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Daily and Weekly compression path, plus an early 60% cup (U recovered 60% of its depth, still under the neckline).
          {asOf ? ` · as of ${String(asOf).replace('T', ' ').slice(0, 19)} IST` : ''}
        </Typography>
        <Alert severity="info" sx={{ py: 0.5, mb: 1.5, fontSize: 12 }}>
          Checklist: compression first → volume expanded + strong close → level held on lighter retest volume
          → renewed participation. Stop hint is under the compression / breakout structure (if it fails, where am I wrong?).
        </Alert>
      </Box>

      <Box display="flex" flexWrap="wrap" gap={1.5} alignItems="center" mb={1.5}>
        <TextField
          select
          size="small"
          label="Timeframe"
          value={timeframe}
          onChange={(e) => setTimeframe(e.target.value)}
          sx={{ minWidth: 120 }}
        >
          {COMPRESSION_BREAKOUT_TIMEFRAMES.map((o) => (
            <MenuItem key={o.id} value={o.id}>{o.label}</MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Phase"
          value={phaseFilter}
          onChange={(e) => setPhaseFilter(e.target.value)}
          sx={{ minWidth: 200 }}
        >
          {COMPRESSION_BREAKOUT_PHASES.map((o) => (
            <MenuItem key={o.id || 'all'} value={o.id}>{o.label}</MenuItem>
          ))}
        </TextField>
        <FormControlLabel
          control={(
            <Switch
              size="small"
              checked={includeCompression}
              onChange={(e) => setIncludeCompression(e.target.checked)}
            />
          )}
          label="Include compression watch"
        />
        <TextField
          size="small"
          label="Search"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          sx={{ minWidth: 160 }}
        />
        <Button
          size="small"
          variant="outlined"
          startIcon={<MdRefresh />}
          onClick={() => load({ refresh: true })}
          disabled={loading}
          sx={{ textTransform: 'none' }}
        >
          Refresh
        </Button>
        <Button
          size="small"
          variant="outlined"
          onClick={handleCopyCsv}
          disabled={!filtered.length}
          sx={{ textTransform: 'none' }}
        >
          {copied ? 'Copied' : `Copy CSV (${filtered.length})`}
        </Button>
        {loading ? <CircularProgress size={22} /> : null}
      </Box>

      {error ? <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert> : null}

      <TableWrapper>
        <Table>
          <thead>
            <tr>
              {COLS.map((c) => (
                <th
                  key={c.key}
                  style={{ ...compact, cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => requestSort(c.key)}
                >
                  <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                    {c.label}
                    {sortIcon(c.key)}
                  </Box>
                </th>
              ))}
              <th style={compact}>Checklist</th>
            </tr>
          </thead>
          <tbody>
            {!loading && !pageRows.length ? (
              <tr>
                <td colSpan={COLS.length + 1} style={{ ...compact, textAlign: 'center', padding: 24, color: '#78909c' }}>
                  No matching setups for this timeframe / phase.
                </td>
              </tr>
            ) : null}
            {pageRows.map((row) => (
              <tr key={`${row.symbol}-${row.phase}-${row.breakout_date || 'x'}`}>
                <td style={{ ...compact, ...symbolCellTdStyle }}>
                  <SymbolWithTradingView symbol={row.symbol} />
                </td>
                <td style={compact}>{row.timeframe === '1w' ? 'Weekly' : row.timeframe === '1d' ? 'Daily' : (row.timeframe || '—')}</td>
                <td style={compact}>
                  <Chip
                    size="small"
                    label={formatPhaseLabel(row.phase)}
                    color={phaseChipColor(row.phase)}
                    sx={{ height: 22, fontSize: 11 }}
                  />
                </td>
                <td style={compact}>{formatEvidenceScore(row.evidence_score, row.evidence_max || 6)}</td>
                <td style={compact}>{fmtPx(row.close)}</td>
                <td style={compact}>{fmtPx(row.breakout_level)}</td>
                <td style={compact}>{fmtPx(row.stop_hint)}</td>
                <td style={compact}>
                  {row.bars_since_breakout != null && row.bars_since_breakout >= 0
                    ? row.bars_since_breakout
                    : '—'}
                </td>
                <td style={compact}>{fmtNum(row.breakout_volume_ratio)}</td>
                <td style={compact}>{fmtNum(row.retest_volume_ratio)}</td>
                <td style={compact}>{fmtNum(row.compression_atr_ratio)}</td>
                <td style={compact}>{row.sector || '—'}</td>
                <td style={compact}><ChecklistDots checklist={row.checklist} /></td>
              </tr>
            ))}
          </tbody>
        </Table>
      </TableWrapper>

      {pageCount > 1 ? (
        <Box display="flex" justifyContent="center" mt={2}>
          <Pagination count={pageCount} page={page} onChange={(_, p) => setPage(p)} size="small" />
        </Box>
      ) : null}
    </TableSection>
  );
}

export default CompressionBreakoutTab;
