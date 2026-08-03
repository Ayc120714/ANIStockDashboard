import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { TableTitle, TableWrapper, Table } from '../pages/SectorOutlook.styles';
import { Box, Button, Chip, CircularProgress, Typography } from '@mui/material';
import Pagination from '@mui/material/Pagination';
import { FaSort, FaSortDown, FaSortUp } from 'react-icons/fa';
import { fetchRenkoSmartSignals } from '../api/advisor';
import { SymbolWithTradingView, symbolCellTdStyle } from '../components/TradingViewLink';
import { formatAlertTimeIST } from '../utils/alertInboxUtils';
import { readPageCache, writePageCache } from '../utils/pageDataCache';
import { runLiveMarketPageMountPoll } from '../utils/screenPageLoader';

const POLL_MS = 5 * 60 * 1000;
const PAGE_SIZE = 25;
const CACHE_KEY = 'advisor_renko_fib_zone_table_v1';

const COLS = [
  { key: 'symbol', label: 'Symbol' },
  { key: 'close', label: 'CMP' },
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

const compact = { fontSize: 12, padding: '4px 6px', whiteSpace: 'nowrap' };

export default function RenkoSmartTable() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scanSymbols, setScanSymbols] = useState(0);
  const [lastSync, setLastSync] = useState(null);
  const [page, setPage] = useState(1);
  const [sortCol, setSortCol] = useState('symbol');
  const [sortDir, setSortDir] = useState('asc');

  const load = useCallback(async ({ silent = false, forceNetwork = false } = {}) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      if (!forceNetwork) {
        const cached = readPageCache(CACHE_KEY);
        if (cached?.data?.length) {
          setRows(cached.data);
          setScanSymbols(cached.scanSymbols || cached.data.length);
          setLastSync(cached.updatedAt || null);
          if (!silent) setLoading(false);
        }
      }
      const payload = await fetchRenkoSmartSignals({
        limit: 500,
        symbol_limit: 1500,
        hits_only: true,
        refresh: forceNetwork,
      });
      const data = Array.isArray(payload?.data) ? payload.data : [];
      setRows(data);
      setScanSymbols(payload?.scan_symbols || data.length);
      setLastSync(new Date().toISOString());
      writePageCache(CACHE_KEY, { data, scanSymbols: payload?.scan_symbols || data.length });
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
      if (sortCol === 'symbol') {
        return mul * String(a[sortCol] || '').localeCompare(String(b[sortCol] || ''));
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
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 1.5 }}>
        <Chip size="small" label={`${sorted.length} setups · ${scanSymbols} scanned`} variant="outlined" />
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
                  <tr key={`${r.symbol}-${r.bar_time_5m || ''}`}>
                    <td style={{ ...compact, ...symbolCellTdStyle }}>
                      <SymbolWithTradingView symbol={r.symbol} />
                    </td>
                    <td style={compact}>{fmtNum(r.close)}</td>
                    <td style={compact}>{fmtNum(r.target_1)}</td>
                    <td style={compact}>{fmtNum(r.target_2)}</td>
                    <td style={compact}>{fmtNum(r.stop_loss)}</td>
                  </tr>
                ))}
                {paged.length === 0 && (
                  <tr>
                    <td colSpan={COLS.length} style={{ textAlign: 'center', padding: 20, color: '#888' }}>
                      No Renko Smart setups yet.
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
