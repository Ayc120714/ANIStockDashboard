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

const DAILY_COLS = [
  { key: 'symbol', label: 'Symbol', width: 88 },
  { key: 'sector', label: 'Sector', width: 100 },
  { key: 'close', label: 'Close', numeric: true, width: 80 },
  { key: 'rs_daily_123', label: 'RS123', numeric: true, pct: true, width: 68 },
  { key: 'di_plus', label: 'DI+', numeric: true, width: 56 },
  { key: 'rating', label: 'Rating', width: 68 },
  { key: 'horizon', label: 'Horizon', width: 76 },
];

const WEEKLY_COLS = [
  { key: 'symbol', label: 'Symbol', width: 88 },
  { key: 'sector', label: 'Sector', width: 96 },
  { key: 'weekly_close', label: 'Wk Close', numeric: true, width: 80 },
  { key: 'weekly_close_prev', label: 'Prev Wk', numeric: true, width: 80 },
  { key: 'rs_weekly_52', label: 'RS52', numeric: true, pct: true, width: 68 },
  { key: 'di_plus', label: 'DI+', numeric: true, width: 56 },
  { key: 'rating', label: 'Rating', width: 68 },
  { key: 'horizon', label: 'Horizon', width: 76 },
];

const MONTHLY_COLS = [
  { key: 'symbol', label: 'Symbol', width: 88 },
  { key: 'sector', label: 'Sector', width: 96 },
  { key: 'monthly_close', label: 'Mo Close', numeric: true, width: 80 },
  { key: 'monthly_close_prev', label: 'Prev Mo', numeric: true, width: 80 },
  { key: 'rs_monthly_11', label: 'RS11', numeric: true, pct: true, width: 68 },
  { key: 'di_plus', label: 'DI+', numeric: true, width: 56 },
  { key: 'rating', label: 'Rating', width: 68 },
  { key: 'horizon', label: 'Horizon', width: 76 },
];

const CHARTINK_DAILY_URL = 'https://chartink.com/screener/rs-daily-scan-2';
const CHARTINK_WEEKLY_URL = 'https://chartink.com/screener/rs-weekly-scan-3';
const CHARTINK_MONTHLY_URL = 'https://chartink.com/screener/rs-monthly-11';

const fmt = (v) => {
  if (v == null || v === '' || Number.isNaN(Number(v))) return '—';
  return `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const fmtPct = (v) => {
  if (v == null || v === '' || Number.isNaN(Number(v))) return '—';
  const n = Number(v);
  const pct = Math.abs(n) <= 5 ? n * 100 : n;
  return `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%`;
};

const fmtNum = (v, digits = 1) => {
  if (v == null || v === '' || Number.isNaN(Number(v))) return '—';
  return Number(v).toFixed(digits);
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
  if (
    key === 'close'
    || key === 'weekly_close'
    || key === 'weekly_close_prev'
    || key === 'monthly_close'
    || key === 'monthly_close_prev'
    || key === 'rs_daily_123'
    || key === 'rs_weekly_52'
    || key === 'rs_monthly_11'
    || key === 'di_plus'
  ) {
    const n = Number(row[key]);
    return Number.isFinite(n) ? n : null;
  }
  return row[key];
}

function filterAndSortRows(rows, { search, sector, sortCol, sortDir }) {
  let out = [...rows];
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
}

function AgentResultsTable({
  title,
  subtitle,
  chartinkUrl,
  cols,
  rows,
  emptyMessage,
  sortCol,
  sortDir,
  onSort,
  page,
  rowsPerPage,
  onPageChange,
}) {
  const totalPages = Math.max(1, Math.ceil(rows.length / rowsPerPage));
  const safePage = Math.min(page, totalPages);
  const rangeStart = rows.length === 0 ? 0 : (safePage - 1) * rowsPerPage + 1;
  const rangeEnd = Math.min(safePage * rowsPerPage, rows.length);
  const paged = rows.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage);

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <FaSort style={{ opacity: 0.3, marginLeft: 3, fontSize: 10 }} />;
    return sortDir === 'asc'
      ? <FaSortUp style={{ color: '#fff', marginLeft: 3, fontSize: 10 }} />
      : <FaSortDown style={{ color: '#fff', marginLeft: 3, fontSize: 10 }} />;
  };

  const renderCell = (r, col) => {
    if (col.key === 'symbol') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {r.symbol || '—'}
          <TradingViewLink symbol={r.symbol} />
        </span>
      );
    }
    if (col.key === 'sector') {
      return r.sector || '—';
    }
    if (
      col.key === 'close'
      || col.key === 'weekly_close'
      || col.key === 'weekly_close_prev'
      || col.key === 'monthly_close'
      || col.key === 'monthly_close_prev'
    ) {
      return fmt(r[col.key]);
    }
    if (col.pct) {
      return fmtPct(r[col.key]);
    }
    if (col.key === 'di_plus') {
      return fmtNum(r[col.key], 1);
    }
    if (col.key === 'rating') {
      const ratingLabel = r.rating ? String(r.rating).replace(/_/g, ' ') : null;
      const ratingStyle = ratingChipStyle(r.rating);
      if (!ratingLabel) return <span style={{ color: '#bbb', fontSize: 10 }}>—</span>;
      return (
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
      );
    }
    if (col.key === 'horizon') {
      return (
        <Tooltip title={r.horizon_reason || ''}>
          <span>{horizonLabel(r.horizon)}</span>
        </Tooltip>
      );
    }
    return r[col.key] ?? '—';
  };

  return (
    <Box sx={{ minWidth: 280, flex: '1 1 0', width: 0 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1a3c5e', mb: 0.25, fontSize: 14 }}>
        {title}
      </Typography>
      {subtitle && (
        <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: 11, mb: 0.5 }}>
          {subtitle}
        </Typography>
      )}
      {chartinkUrl && (
        <Typography variant="body2" sx={{ fontSize: 11, mb: 1 }}>
          <a href={chartinkUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#1565c0' }}>
            ChartInk reference
          </a>
        </Typography>
      )}
      {rows.length > 0 && (
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
            Showing {rangeStart}–{rangeEnd} of {rows.length}
          </Typography>
          {totalPages > 1 && (
            <Pagination
              count={totalPages}
              page={safePage}
              onChange={(_, v) => onPageChange(v)}
              color="primary"
              size="small"
              siblingCount={1}
              boundaryCount={1}
            />
          )}
        </Box>
      )}
      <TableWrapperCompact>
        <TableCompact
          style={{
            fontSize: 11,
            width: '100%',
            tableLayout: 'fixed',
          }}
        >
          <colgroup>
            {cols.map((col) => (
              <col key={col.key} style={{ width: col.width }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {cols.map((col) => (
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
                  onClick={() => onSort(col.key)}
                >
                  {col.label}
                  <SortIcon col={col.key} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((r, i) => {
              const rowBg = r.passed_all ? '#e8f5e9' : undefined;
              return (
                <tr key={`${r.symbol}-${i}`} style={{ background: rowBg }}>
                  {cols.map((col) => (
                    <td
                      key={col.key}
                      style={{
                        ...compact,
                        fontWeight: col.key === 'symbol' ? 700 : col.numeric ? 600 : undefined,
                        textAlign: col.numeric ? 'right' : 'left',
                        width: col.width,
                        maxWidth: col.key === 'sector' ? col.width : undefined,
                        overflow: col.key === 'sector' ? 'hidden' : undefined,
                        textOverflow: col.key === 'sector' ? 'ellipsis' : undefined,
                        fontSize: col.key === 'sector' ? 11 : undefined,
                        color: col.key === 'horizon' ? '#37474f' : undefined,
                      }}
                      title={col.key === 'sector' ? (r.sector || '') : undefined}
                    >
                      {renderCell(r, col)}
                    </td>
                  ))}
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={cols.length} style={{ textAlign: 'center', padding: 24, color: '#888' }}>
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </TableCompact>
      </TableWrapperCompact>
      {rows.length > 0 && totalPages > 1 && (
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
            {rangeStart}–{rangeEnd} of {rows.length}
          </Typography>
          <Pagination
            count={totalPages}
            page={safePage}
            onChange={(_, v) => onPageChange(v)}
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

export default function ChartFundamentalAgentTab() {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [sector, setSector] = useState('__all__');
  const [showNearMiss, setShowNearMiss] = useState(false);
  const [dailySortCol, setDailySortCol] = useState('symbol');
  const [dailySortDir, setDailySortDir] = useState('asc');
  const [weeklySortCol, setWeeklySortCol] = useState('symbol');
  const [weeklySortDir, setWeeklySortDir] = useState('asc');
  const [monthlySortCol, setMonthlySortCol] = useState('symbol');
  const [monthlySortDir, setMonthlySortDir] = useState('asc');
  const [dailyPage, setDailyPage] = useState(1);
  const [weeklyPage, setWeeklyPage] = useState(1);
  const [monthlyPage, setMonthlyPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const CACHE_KEY = 'advisor_chart_fundamental_agent_v5';

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
        hasUsable: (p) => Boolean(
          p && (Array.isArray(p.data) || Array.isArray(p.weekly_data) || Array.isArray(p.monthly_data)),
        ),
      });
    },
    [showNearMiss],
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const dailyRows = useMemo(
    () => filterAndSortRows(payload?.data || [], {
      search,
      sector,
      sortCol: dailySortCol,
      sortDir: dailySortDir,
    }),
    [payload, search, sector, dailySortCol, dailySortDir],
  );

  const weeklyRows = useMemo(
    () => filterAndSortRows(payload?.weekly_data || [], {
      search,
      sector,
      sortCol: weeklySortCol,
      sortDir: weeklySortDir,
    }),
    [payload, search, sector, weeklySortCol, weeklySortDir],
  );

  const monthlyRows = useMemo(
    () => filterAndSortRows(payload?.monthly_data || [], {
      search,
      sector,
      sortCol: monthlySortCol,
      sortDir: monthlySortDir,
    }),
    [payload, search, sector, monthlySortCol, monthlySortDir],
  );

  const sectorOptions = useMemo(() => {
    const set = new Set();
    [...(payload?.data || []), ...(payload?.weekly_data || []), ...(payload?.monthly_data || [])].forEach((r) => {
      if (r.sector && String(r.sector).trim()) set.add(String(r.sector).trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [payload]);

  const handleSort = (table, col) => {
    const isDaily = table === 'daily';
    const isWeekly = table === 'weekly';
    const sortCol = isDaily ? dailySortCol : isWeekly ? weeklySortCol : monthlySortCol;
    const sortDir = isDaily ? dailySortDir : isWeekly ? weeklySortDir : monthlySortDir;
    const setSortCol = isDaily ? setDailySortCol : isWeekly ? setWeeklySortCol : setMonthlySortCol;
    const setSortDir = isDaily ? setDailySortDir : isWeekly ? setWeeklySortDir : setMonthlySortDir;
    const setPage = isDaily ? setDailyPage : isWeekly ? setWeeklyPage : setMonthlyPage;

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

  const scanMeta = payload?.scan_symbols
    ? ` · scanned ${payload.scan_symbols} symbols${payload?.cached ? ' (cached)' : ''}`
    : payload?.cached ? ' (cached)' : '';

  return (
    <Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2, alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="Symbol…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setDailyPage(1); setWeeklyPage(1); setMonthlyPage(1); }}
          sx={{ width: 110 }}
        />
        <TextField
          select
          size="small"
          label="Sector"
          value={sector}
          onChange={(e) => { setSector(e.target.value); setDailyPage(1); setWeeklyPage(1); setMonthlyPage(1); }}
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
              onChange={(e) => { setShowNearMiss(e.target.checked); setDailyPage(1); setWeeklyPage(1); setMonthlyPage(1); }}
            />
          }
          label={<Typography variant="body2" sx={{ fontSize: 12 }}>Show near-misses</Typography>}
        />
        <TextField
          select
          size="small"
          value={rowsPerPage}
          onChange={(e) => { setRowsPerPage(Number(e.target.value)); setDailyPage(1); setWeeklyPage(1); setMonthlyPage(1); }}
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

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'nowrap',
            gap: 2,
            alignItems: 'flex-start',
            width: '100%',
            overflowX: 'auto',
          }}
        >
          <AgentResultsTable
            title="Daily setup (RS 123)"
            subtitle={`${payload?.count ?? dailyRows.length} matches${scanMeta}`}
            chartinkUrl={CHARTINK_DAILY_URL}
            cols={DAILY_COLS}
            rows={dailyRows}
            emptyMessage="No stocks passed all gates on the latest daily session."
            sortCol={dailySortCol}
            sortDir={dailySortDir}
            onSort={(col) => handleSort('daily', col)}
            page={dailyPage}
            rowsPerPage={rowsPerPage}
            onPageChange={setDailyPage}
          />
          <AgentResultsTable
            title="Weekly setup (RS 52W)"
            subtitle={`${payload?.weekly_count ?? weeklyRows.length} matches · weekly vs Nifty${scanMeta}`}
            chartinkUrl={CHARTINK_WEEKLY_URL}
            cols={WEEKLY_COLS}
            rows={weeklyRows}
            emptyMessage="No stocks passed all gates on the latest weekly bar."
            sortCol={weeklySortCol}
            sortDir={weeklySortDir}
            onSort={(col) => handleSort('weekly', col)}
            page={weeklyPage}
            rowsPerPage={rowsPerPage}
            onPageChange={setWeeklyPage}
          />
            <AgentResultsTable
              title="Monthly setup (RS 11M)"
              subtitle={`${payload?.monthly_count ?? monthlyRows.length} matches · ChartInk monthly vs Nifty (11)${scanMeta}`}
              chartinkUrl={CHARTINK_MONTHLY_URL}
              cols={MONTHLY_COLS}
            rows={monthlyRows}
            emptyMessage="No stocks passed all gates on the latest monthly bar."
            sortCol={monthlySortCol}
            sortDir={monthlySortDir}
            onSort={(col) => handleSort('monthly', col)}
            page={monthlyPage}
            rowsPerPage={rowsPerPage}
            onPageChange={setMonthlyPage}
          />
        </Box>
      )}
    </Box>
  );
}
