import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { TableTitle, TableWrapper, Table } from '../pages/SectorOutlook.styles';
import { Box, Button, Chip, CircularProgress, Typography } from '@mui/material';
import Pagination from '@mui/material/Pagination';
import { FaSort, FaSortDown, FaSortUp } from 'react-icons/fa';
import { fetchRenkoSmartSignals } from '../api/advisor';
import { SymbolWithTradingView, symbolCellTdStyle, buildTradingViewSymbolsCsv } from '../components/TradingViewLink';
import { formatAlertTimeIST } from '../utils/alertInboxUtils';
import { readPageCache, writePageCache } from '../utils/pageDataCache';
import { runLiveMarketPageMountPoll } from '../utils/screenPageLoader';

const POLL_MS = 5 * 60 * 1000;
const PAGE_SIZE = 25;
const CACHE_KEY = 'advisor_renko_smart_combined_5m_latest10_v1';
const LIST_LIMIT = 10;

const COLS = [
  { key: 'symbol', label: 'Symbol' },
  { key: 'signal_time_5m', label: 'Signal 5m' },
  { key: 'close', label: 'CMP' },
  { key: 'upper_44', label: 'Upper 44%' },
  { key: 'upper_50', label: 'Upper 50%' },
  { key: 'ema10', label: 'EMA10' },
  { key: 'ema30', label: 'EMA30' },
  { key: 'supertrend', label: 'ST' },
  { key: 'target_1', label: 'T1' },
  { key: 'target_2', label: 'T2' },
  { key: 'stop_loss', label: 'SL' },
];

const fmtNum = (v, digits = 2) => {
  if (v == null || v === '' || Number.isNaN(Number(v))) return '—';
  return Number(v).toLocaleString('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

const fmtSignalTime = (v) => {
  if (!v) return '—';
  const s = String(v);
  // Prefer HH:MM from ISO / datetime strings
  const m = s.match(/(\d{2}:\d{2})(?::\d{2})?/);
  if (m) return m[1];
  return formatAlertTimeIST(s) || s;
};

const compact = { fontSize: 12, padding: '4px 6px', whiteSpace: 'nowrap' };

export default function RenkoSmartTable() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scanSymbols, setScanSymbols] = useState(0);
  const [sessionDate, setSessionDate] = useState('');
  const [lastSync, setLastSync] = useState(null);
  const [page, setPage] = useState(1);
  const [sortCol, setSortCol] = useState('signal_time_5m');
  const [sortDir, setSortDir] = useState('desc');
  const [copied, setCopied] = useState(false);

  const load = useCallback(async ({ silent = false, forceNetwork = false } = {}) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      if (!forceNetwork) {
        const cached = readPageCache(CACHE_KEY);
        if (cached?.data?.length) {
          setRows(cached.data);
          setScanSymbols(cached.scanSymbols || cached.data.length);
          setSessionDate(cached.sessionDate || '');
          setLastSync(cached.updatedAt || null);
          if (!silent) setLoading(false);
        }
      }
      const payload = await fetchRenkoSmartSignals({
        limit: LIST_LIMIT,
        symbol_limit: 1500,
        hits_only: true,
        refresh: forceNetwork,
      });
      const data = Array.isArray(payload?.data) ? payload.data : [];
      setRows(data);
      setScanSymbols(payload?.scan_symbols || data.length);
      setSessionDate(payload?.session_date || '');
      setLastSync(new Date().toISOString());
      writePageCache(CACHE_KEY, {
        data,
        scanSymbols: payload?.scan_symbols || data.length,
        sessionDate: payload?.session_date || '',
      });
    } catch (e) {
      setError(String(e?.message || 'Could not load Renko Smart signals'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

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
    const mul = sortDir === 'asc' ? 1 : -1;
    const list = [...rows];
    if (!sortCol) return list;
    list.sort((a, b) => {
      if (sortCol === 'symbol' || sortCol === 'signal_time_5m') {
        const av = String(a[sortCol] || a.bar_time_5m || '');
        const bv = String(b[sortCol] || b.bar_time_5m || '');
        return mul * av.localeCompare(bv);
      }
      const na = Number(a[sortCol]);
      const nb = Number(b[sortCol]);
      if (!Number.isFinite(na) && !Number.isFinite(nb)) return 0;
      if (!Number.isFinite(na)) return 1;
      if (!Number.isFinite(nb)) return -1;
      return mul * (na - nb);
    });
    return list;
  }, [rows, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleCopyCsv = async () => {
    const csv = buildTradingViewSymbolsCsv(sorted.map((r) => r.symbol));
    if (!csv) return;
    try {
      await navigator.clipboard.writeText(csv);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Could not copy CSV (use HTTPS or allow clipboard access)');
    }
  };

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <FaSort style={{ opacity: 0.35, marginLeft: 3, fontSize: 10 }} />;
    return sortDir === 'asc'
      ? <FaSortUp style={{ marginLeft: 3, fontSize: 10 }} />
      : <FaSortDown style={{ marginLeft: 3, fontSize: 10 }} />;
  };

  return (
    <Box id="advisor-renko-smart" sx={{ mb: 2 }}>
      <TableTitle style={{ fontSize: 15, marginBottom: 8, color: '#0b3d91' }}>
        Renko Smart
      </TableTitle>
      <Typography sx={{ fontSize: 12, color: '#555', mb: 1 }}>
        Latest {LIST_LIMIT} for the session day (5m): upper Renko 44–50% cross · EMA cloud green · SuperTrend flip. Works after close / weekends.
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 1.5 }}>
        <Chip
          size="small"
          label={`${sorted.length} of latest ${LIST_LIMIT} · ${scanSymbols} scanned · 5m${sessionDate ? ` · ${sessionDate}` : ''}`}
          variant="outlined"
        />
        {lastSync ? <Chip size="small" label={`Updated ${formatAlertTimeIST(lastSync)}`} variant="outlined" /> : null}
        <Button
          size="small"
          variant="outlined"
          disabled={loading}
          onClick={() => load({ forceNetwork: true })}
          sx={{ textTransform: 'none', fontSize: 12 }}
        >
          Refresh
        </Button>
        <Button
          size="small"
          variant="contained"
          disabled={!sorted.length}
          onClick={handleCopyCsv}
          sx={{ textTransform: 'none', fontSize: 12 }}
        >
          {copied ? 'Copied!' : `Copy CSV (${sorted.length})`}
        </Button>
      </Box>
      {error ? <Typography color="error" sx={{ fontSize: 12, mb: 1 }}>{error}</Typography> : null}
      {loading && rows.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} /></Box>
      ) : (
        <>
          <TableWrapper>
            <Table style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  {COLS.map((col) => (
                    <th
                      key={col.key}
                      style={{ ...compact, cursor: 'pointer' }}
                      onClick={() => {
                        if (sortCol === col.key) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
                        else { setSortCol(col.key); setSortDir('desc'); }
                        setPage(1);
                      }}
                    >
                      {col.label}
                      <SortIcon col={col.key} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map((r) => (
                  <tr key={`${r.symbol}-${r.signal_time_5m || r.bar_time_5m || ''}`}>
                    <td style={symbolCellTdStyle(compact)}>
                      <SymbolWithTradingView symbol={r.symbol} />
                    </td>
                    <td style={compact}>{fmtSignalTime(r.signal_time_5m || r.bar_time_5m)}</td>
                    <td style={compact}>{fmtNum(r.close)}</td>
                    <td style={compact}>{fmtNum(r.upper_44)}</td>
                    <td style={compact}>{fmtNum(r.upper_50)}</td>
                    <td style={compact}>{fmtNum(r.ema10 ?? r.ma1)}</td>
                    <td style={compact}>{fmtNum(r.ema30 ?? r.ma2)}</td>
                    <td style={compact}>{fmtNum(r.supertrend)}</td>
                    <td style={compact}>{fmtNum(r.target_1)}</td>
                    <td style={compact}>{fmtNum(r.target_2)}</td>
                    <td style={compact}>{fmtNum(r.stop_loss)}</td>
                  </tr>
                ))}
                {paged.length === 0 && (
                  <tr>
                    <td colSpan={COLS.length} style={{ textAlign: 'center', padding: 20, color: '#888' }}>
                      No combined Renko Smart 5m setups for the latest session yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </TableWrapper>
          {sorted.length > PAGE_SIZE && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
              <Pagination count={totalPages} page={page} onChange={(_, v) => setPage(v)} size="small" />
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
