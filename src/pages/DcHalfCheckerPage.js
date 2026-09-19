import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, ButtonGroup, CircularProgress, TextField, Typography } from '@mui/material';
import Pagination from '@mui/material/Pagination';
import { TableSection, TableTitle, TableWrapper, Table } from './SectorOutlook.styles';
import { PageContainer, PageTitle } from './ScreensPage.style';
import { fetchDcHalfChecker } from '../api/advisor';
import { SymbolWithTradingView, symbolCellTdStyle, buildTradingViewSymbolsCsv } from '../components/TradingViewLink';
import { useAuth } from '../auth/AuthContext';
import { LIVE_PAGE_CACHE_KEYS } from '../utils/livePageCacheKeys';
import { readPageCache, writePageCache } from '../utils/pageDataCache';
import {
  DC_HALF_TIMEFRAMES,
  formatDcHalfPhase,
  formatDcHalfPrice,
  normalizeDcHalfTimeframe,
} from '../utils/dcHalfChecker';

function DcHalfCheckerPage() {
  const { isAuthenticated, bootstrapping } = useAuth();
  const [timeframe, setTimeframe] = useState('1d');
  const [page, setPage] = useState(1);
  const rowsPerPage = 15;
  const [searchTerm, setSearchTerm] = useState('');
  const [tableData, setTableData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'bars_since_cross', ascending: true });
  const [asOf, setAsOf] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (bootstrapping) return undefined;
    if (!isAuthenticated) {
      setIsLoading(false);
      setTableData([]);
      setLoadError('Please login to load DC Half Checker.');
      return undefined;
    }

    let cancelled = false;
    setPage(1);
    const tf = normalizeDcHalfTimeframe(timeframe);
    const cacheKey = LIVE_PAGE_CACHE_KEYS.dcHalfChecker(tf);

    const cached = readPageCache(cacheKey);
    if (cached?.data && Array.isArray(cached.data) && cached.data.length > 0) {
      setTableData(cached.data);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }
    setLoadError(null);

    (async () => {
      try {
        const res = await fetchDcHalfChecker({
          timeframe: tf,
          limit: 300,
          symbol_limit: 800,
          refresh: false,
          cache_ttl_sec: 180,
        });
        if (cancelled) return;
        const rows = Array.isArray(res?.data) ? res.data : [];
        writePageCache(cacheKey, rows);
        setTableData(rows);
        setAsOf(res?.as_of || null);
        setLoadError(null);

        // Prefetch other TFs into page cache so tab switches stay fast.
        DC_HALF_TIMEFRAMES.forEach(({ id }) => {
          if (id === tf) return;
          const otherKey = LIVE_PAGE_CACHE_KEYS.dcHalfChecker(id);
          const existing = readPageCache(otherKey);
          if (existing?.data?.length) return;
          fetchDcHalfChecker({
            timeframe: id,
            limit: 300,
            symbol_limit: 800,
            refresh: false,
            cache_ttl_sec: 180,
          })
            .then((otherRes) => {
              if (cancelled) return;
              const otherRows = Array.isArray(otherRes?.data) ? otherRes.data : [];
              writePageCache(otherKey, otherRows);
            })
            .catch(() => {});
        });
      } catch (e) {
        if (cancelled) return;
        if (!cached?.data?.length) {
          setTableData([]);
          setLoadError(e?.message || 'Failed to load DC Half Checker.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [bootstrapping, isAuthenticated, timeframe]);

  const filteredData = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    let rows = tableData;
    if (q) {
      rows = rows.filter((r) => {
        const hay = `${r.symbol || ''} ${r.sector || ''} ${r.subsector || ''} ${r.phase || ''}`.toLowerCase();
        return hay.includes(q);
      });
    }
    const { key, ascending } = sortConfig;
    if (!key) return rows;
    const sorted = [...rows].sort((a, b) => {
      const av = a?.[key];
      const bv = b?.[key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') {
        return ascending ? av - bv : bv - av;
      }
      return ascending
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return sorted;
  }, [tableData, searchTerm, sortConfig]);

  const pageCount = Math.max(1, Math.ceil(filteredData.length / rowsPerPage));
  const pageRows = filteredData.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  const handleCopyCsv = async () => {
    const csv = buildTradingViewSymbolsCsv(filteredData.map((r) => r.symbol));
    if (!csv) return;
    try {
      await navigator.clipboard.writeText(csv);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setLoadError('Could not copy CSV (use HTTPS or allow clipboard access)');
    }
  };

  const requestSort = (key) => {
    setSortConfig((prev) => (
      prev.key === key
        ? { key, ascending: !prev.ascending }
        : { key, ascending: true }
    ));
  };

  const showWeeklyEmas = timeframe === '1w';

  return (
    <PageContainer>
      <PageTitle>DC Half Checker</PageTitle>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Close crossed above DC_HALF (20) · Market Cap &gt; 2000 Cr · EMA stack · Phase tags for Setup 1 / Setup 2 review
        {asOf ? ` · as of ${String(asOf).replace('T', ' ').slice(0, 19)} IST` : ''}
      </Typography>

      <TableSection style={{ marginTop: 0 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1} mb={2}>
          <ButtonGroup size="small">
            {DC_HALF_TIMEFRAMES.map((tf) => (
              <Button
                key={tf.id}
                variant={timeframe === tf.id ? 'contained' : 'outlined'}
                onClick={() => setTimeframe(tf.id)}
              >
                {tf.label}
              </Button>
            ))}
          </ButtonGroup>
          <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
            <TextField
              size="small"
              placeholder="Search symbol / sector / phase..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              sx={{ minWidth: 240 }}
            />
            <Button
              size="small"
              variant="contained"
              disabled={!filteredData.length || isLoading}
              onClick={handleCopyCsv}
              sx={{ textTransform: 'none', fontSize: 12, whiteSpace: 'nowrap' }}
            >
              {copied ? 'Copied!' : `Copy CSV (${filteredData.length})`}
            </Button>
          </Box>
        </Box>

        {isLoading ? (
          <Box display="flex" flexDirection="column" alignItems="center" py={6} gap={2}>
            <CircularProgress />
            <Typography color="text.secondary">
              Scanning universe for {timeframe.toUpperCase()} DC_HALF crosses…
            </Typography>
          </Box>
        ) : loadError ? (
          <Typography color="error" sx={{ py: 3 }}>{loadError}</Typography>
        ) : (
          <>
            <TableTitle>
              {timeframe.toUpperCase()} · {filteredData.length} stock{filteredData.length === 1 ? '' : 's'}
            </TableTitle>
            <TableWrapper>
              <Table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th onClick={() => requestSort('symbol')} style={{ cursor: 'pointer' }}>Symbol</th>
                    <th onClick={() => requestSort('sector')} style={{ cursor: 'pointer' }}>Sector</th>
                    <th>Sub Sector</th>
                    <th onClick={() => requestSort('market_cap_cr')} style={{ cursor: 'pointer' }}>MC</th>
                    <th onClick={() => requestSort('close')} style={{ cursor: 'pointer' }}>Close</th>
                    <th>DC_HALF</th>
                    <th>DC High</th>
                    <th>DC Low</th>
                    {showWeeklyEmas ? (
                      <>
                        <th>EMA30 W</th>
                        <th>EMA100 W</th>
                        <th>EMA200 D</th>
                      </>
                    ) : (
                      <>
                        <th>EMA21</th>
                        <th>EMA100</th>
                        <th>EMA200</th>
                      </>
                    )}
                    <th onClick={() => requestSort('phase')} style={{ cursor: 'pointer' }}>Phase</th>
                    <th onClick={() => requestSort('pct_vs_dc_half')} style={{ cursor: 'pointer' }}>% vs Mid</th>
                    <th onClick={() => requestSort('bars_since_cross')} style={{ cursor: 'pointer' }}>Bars since X</th>
                    <th>Crossed at</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={16} style={{ textAlign: 'center', padding: 24 }}>
                        No DC_HALF crosses for {timeframe.toUpperCase()} right now.
                      </td>
                    </tr>
                  ) : pageRows.map((row, idx) => (
                    <tr key={`${row.symbol}-${row.crossed_bar_time || idx}`}>
                      <td>{(page - 1) * rowsPerPage + idx + 1}</td>
                      <td style={symbolCellTdStyle({}, 140)}>
                        <SymbolWithTradingView symbol={row.symbol} />
                      </td>
                      <td>{row.sector || '—'}</td>
                      <td>{row.subsector || '—'}</td>
                      <td>{row.market_cap || (row.market_cap_cr != null ? `${row.market_cap_cr} Cr` : '—')}</td>
                      <td>{formatDcHalfPrice(row.close)}</td>
                      <td>{formatDcHalfPrice(row.dc_half)}</td>
                      <td>{formatDcHalfPrice(row.dc_upper)}</td>
                      <td>{formatDcHalfPrice(row.dc_lower)}</td>
                      {showWeeklyEmas ? (
                        <>
                          <td>{formatDcHalfPrice(row.ema30)}</td>
                          <td>{formatDcHalfPrice(row.ema100)}</td>
                          <td>{formatDcHalfPrice(row.ema200)}</td>
                        </>
                      ) : (
                        <>
                          <td>{formatDcHalfPrice(row.ema21)}</td>
                          <td>{formatDcHalfPrice(row.ema100)}</td>
                          <td>{formatDcHalfPrice(row.ema200)}</td>
                        </>
                      )}
                      <td>{formatDcHalfPhase(row.phase)}</td>
                      <td>{row.pct_vs_dc_half != null ? `${row.pct_vs_dc_half}%` : '—'}</td>
                      <td>{row.bars_since_cross != null ? row.bars_since_cross : '—'}</td>
                      <td>{row.crossed_bar_time ? String(row.crossed_bar_time).replace('T', ' ').slice(0, 16) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrapper>
            <Box display="flex" justifyContent="center" mt={2}>
              <Pagination count={pageCount} page={page} onChange={(_, p) => setPage(p)} color="primary" />
            </Box>
          </>
        )}
      </TableSection>
    </PageContainer>
  );
}

export default DcHalfCheckerPage;
