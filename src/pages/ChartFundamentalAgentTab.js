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
import { TableWrapperCompact, TableCompact } from './SectorOutlook.styles';
import { fetchChartFundamentalAgent } from '../api/advisor';
import { runScreenPayloadFetch } from '../utils/screenPageLoader';
import TradingViewLink from '../components/TradingViewLink';

const compact = { fontSize: 12, padding: '4px 6px', whiteSpace: 'nowrap' };
const PAGE_SIZE_OPTIONS = [25, 50, 100];

const COLS = [
  { key: 'symbol', label: 'Symbol', width: 130 },
  { key: 'sector', label: 'Sector', width: 200 },
  { key: 'close', label: 'Close', numeric: true, width: 110 },
  { key: 'rating', label: 'Rating', width: 90 },
  { key: 'horizon', label: 'Horizon', width: 100 },
];

const fmt = (v) => {
  if (v == null || v === '' || Number.isNaN(Number(v))) return '—';
  return `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const horizonLabel = (h) => {
  const v = String(h || '').toLowerCase();
  if (v === 'long_term') return 'Long term';
  if (v === 'short_term') return 'Short term';
  return h || '—';
};

const ratingChipStyle = (rating) => {
  const r = String(rating || '').toLowerCase().replace(/\s+/g, '_');
  if (r.includes('strong_buy') || r === 'strongbuy') {
    return { bgcolor: '#e8f5e9', color: '#1b5e20' };
  }
  if (r.includes('buy')) return { bgcolor: '#f1f8e9', color: '#33691e' };
  if (r.includes('strong_sell') || r === 'strongsell') {
    return { bgcolor: '#ffebee', color: '#b71c1c' };
  }
  if (r.includes('sell')) return { bgcolor: '#ffebee', color: '#c62828' };
  if (r.includes('hold')) return { bgcolor: '#fff8e1', color: '#f57f17' };
  return { bgcolor: '#f5f5f5', color: '#666' };
};

function sortComparable(row, key) {
  if (!row) return null;
  if (key === 'horizon') return horizonLabel(row.horizon);
  if (key === 'rating') return String(row.rating || '').replace(/_/g, ' ');
  if (key === 'close') {
    const n = Number(row.close);
    return Number.isFinite(n) ? n : null;
  }
  return row[key];
}

export default function ChartFundamentalAgentTab() {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [sector, setSector] = useState('__all__');
  const [showNearMiss, setShowNearMiss] = useState(false);
  const [sortCol, setSortCol] = useState('symbol');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const CACHE_KEY = 'advisor_chart_fundamental_agent_v1';

  const load = useCallback(
    async (refresh = false) => {
      await runScreenPayloadFetch({
        cacheKey: CACHE_KEY,
        fetcher: async () => {
          const res = await fetchChartFundamentalAgent({
            refresh,
            symbol_limit: 800,
            limit: 300,
            include_partial: showNearMiss,
            min_gates: showNearMiss ? 1 : 4,
            scan_profile: 'chartink_rs_daily',
          });
          return res ?? null;
        },
        applyPayload: (data) => setPayload(data ?? null),
        setLoading,
        setError,
        forceNetwork: refresh,
        hasUsable: (p) => Boolean(p && Array.isArray(p.data)),
      });
    },
    [showNearMiss],
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const sortedRows = useMemo(() => {
    const base = payload?.data || [];
    let out = [...base];
    const q = search.trim().toLowerCase();
    if (q) {
      out = out.filter((r) => String(r.symbol || '').toLowerCase().includes(q));
    }
    if (sector && sector !== '__all__') {
      out = out.filter((r) => (r.sector || '') === sector);
    }
    const dir = sortDir === 'asc' ? 1 : -1;
    out.sort((a, b) => {
      const va = sortComparable(a, sortCol);
      const vb = sortComparable(b, sortCol);
      const emptyA = va == null || va === '';
      const emptyB = vb == null || vb === '';
      if (emptyA && emptyB) return 0;
      if (emptyA) return 1;
      if (emptyB) return -1;
      if (typeof va === 'number' && typeof vb === 'number') {
        return va < vb ? -dir : va > vb ? dir : 0;
      }
      const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
      return cmp !== 0 ? cmp * dir : String(a.symbol).localeCompare(String(b.symbol)) * dir;
    });
    return out;
  }, [payload, search, sector, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / rowsPerPage));
  const safePage = Math.min(page, totalPages);
  const rangeStart = sortedRows.length === 0 ? 0 : (safePage - 1) * rowsPerPage + 1;
  const rangeEnd = Math.min(safePage * rowsPerPage, sortedRows.length);
  const paged = sortedRows.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage);

  const sectorOptions = useMemo(() => {
    const set = new Set();
    (payload?.data || []).forEach((r) => {
      if (r.sector && String(r.sector).trim()) set.add(String(r.sector).trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [payload]);

  const handleSort = (col) => {
    if (sortCol === col) {
      if (sortDir === 'desc') setSortDir('asc');
      else {
        setSortCol('symbol');
        setSortDir('asc');
      }
    } else {
      setSortCol(col);
      const stringAsc = ['symbol', 'sector', 'rating', 'horizon'].includes(col);
      setSortDir(stringAsc ? 'asc' : 'desc');
    }
    setPage(1);
  };

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <FaSort style={{ opacity: 0.3, marginLeft: 3, fontSize: 10 }} />;
    return sortDir === 'asc'
      ? <FaSortUp style={{ color: '#fff', marginLeft: 3, fontSize: 10 }} />
      : <FaSortDown style={{ color: '#fff', marginLeft: 3, fontSize: 10 }} />;
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2, alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="Symbol…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          sx={{ width: 110 }}
        />
        <TextField
          select
          size="small"
          label="Sector"
          value={sector}
          onChange={(e) => { setSector(e.target.value); setPage(1); }}
          sx={{ minWidth: 160, fontSize: 12 }}
        >
          <MenuItem value="__all__">All sectors</MenuItem>
          {sectorOptions.map((s) => (
            <MenuItem key={s} value={s}>
              {s}
            </MenuItem>
          ))}
        </TextField>
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={showNearMiss}
              onChange={(e) => { setShowNearMiss(e.target.checked); setPage(1); }}
            />
          }
          label={<Typography variant="body2" sx={{ fontSize: 12 }}>Show near-misses</Typography>}
        />
        <TextField
          select
          size="small"
          value={rowsPerPage}
          onChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(1); }}
          sx={{ minWidth: 118, fontSize: 12 }}
        >
          {PAGE_SIZE_OPTIONS.map((n) => (
            <MenuItem key={n} value={n}>{`${n} / page`}</MenuItem>
          ))}
        </TextField>
        <Button
          size="small"
          variant="outlined"
          startIcon={loading ? <CircularProgress size={14} /> : <MdRefresh />}
          onClick={() => load(true)}
          disabled={loading}
          sx={{ textTransform: 'none', ml: 'auto', borderColor: '#1a3c5e', color: '#1a3c5e' }}
        >
          Refresh scan
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {!loading && sortedRows.length > 0 && (
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
          <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: 13 }}>
            Showing {rangeStart}–{rangeEnd} of {sortedRows.length}
            {payload?.scan_symbols ? ` · scanned ${payload.scan_symbols} symbols` : ''}
            {payload?.cached ? ' (cached)' : ''}
          </Typography>
          {totalPages > 1 && (
            <Pagination
              count={totalPages}
              page={safePage}
              onChange={(_, v) => setPage(v)}
              color="primary"
              size="small"
              siblingCount={1}
              boundaryCount={1}
            />
          )}
        </Box>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableWrapperCompact>
          <TableCompact
            style={{
              fontSize: 12,
              width: COLS.reduce((sum, c) => sum + c.width, 0),
            }}
          >
            <colgroup>
              {COLS.map((col) => (
                <col key={col.key} style={{ width: col.width }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {COLS.map((col) => (
                  <th
                    key={col.key}
                    style={{
                      ...compact,
                      width: col.width,
                      cursor: 'pointer',
                      userSelect: 'none',
                      color: '#fff',
                      textAlign: col.numeric ? 'right' : 'left',
                    }}
                    onClick={() => handleSort(col.key)}
                  >
                    {col.label}
                    <SortIcon col={col.key} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map((r, i) => {
                const ratingLabel = r.rating ? String(r.rating).replace(/_/g, ' ') : null;
                const ratingStyle = ratingChipStyle(r.rating);
                const rowBg = r.passed_all ? '#e8f5e9' : undefined;
                return (
                  <tr key={`${r.symbol}-${i}`} style={{ background: rowBg }}>
                    <td style={{ ...compact, fontWeight: 700, width: COLS[0].width }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {r.symbol || '—'}
                        <TradingViewLink symbol={r.symbol} />
                      </span>
                    </td>
                    <td
                      style={{
                        ...compact,
                        fontSize: 11,
                        width: COLS[1].width,
                        maxWidth: COLS[1].width,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={r.sector || ''}
                    >
                      {r.sector || '—'}
                    </td>
                    <td style={{ ...compact, fontWeight: 600, textAlign: 'right', width: COLS[2].width }}>
                      {fmt(r.close)}
                    </td>
                    <td style={{ ...compact, width: COLS[3].width }}>
                      {ratingLabel ? (
                        <Chip
                          label={ratingLabel}
                          size="small"
                          sx={{
                            fontSize: 9,
                            height: 17,
                            fontWeight: 700,
                            textTransform: 'capitalize',
                            ...ratingStyle,
                          }}
                        />
                      ) : (
                        <span style={{ color: '#bbb', fontSize: 10 }}>—</span>
                      )}
                    </td>
                    <td style={{ ...compact, fontWeight: 600, color: '#37474f', width: COLS[4].width }}>
                      <Tooltip title={r.horizon_reason || ''}>
                        <span>{horizonLabel(r.horizon)}</span>
                      </Tooltip>
                    </td>
                  </tr>
                );
              })}
              {sortedRows.length === 0 && (
                <tr>
                  <td colSpan={COLS.length} style={{ textAlign: 'center', padding: 24, color: '#888' }}>
                    No stocks passed all gates on the latest session.
                  </td>
                </tr>
              )}
            </tbody>
          </TableCompact>
        </TableWrapperCompact>
      )}

      {!loading && sortedRows.length > 0 && totalPages > 1 && (
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            mt: 1.5,
            px: 0.5,
          }}
        >
          <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: 12 }}>
            {rangeStart}–{rangeEnd} of {sortedRows.length}
          </Typography>
          <Pagination
            count={totalPages}
            page={safePage}
            onChange={(_, v) => setPage(v)}
            color="primary"
            size="small"
            siblingCount={1}
            boundaryCount={1}
          />
        </Box>
      )}
    </Box>
  );
}
