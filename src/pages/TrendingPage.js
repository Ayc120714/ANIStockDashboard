import React, { useMemo, useState, useEffect } from 'react';
import { TableSection, TableTitle, TableWrapper, Table } from './SectorOutlook.styles';
import { Box, TextField, Typography, Button, Checkbox } from '@mui/material';
import Pagination from '@mui/material/Pagination';
import { CircularProgress } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { fetchTrending, fetchScreenDates } from '../api/stocks';
import { getScreenDatePickerBounds } from '../utils/screenDatePickerBounds';
import { addToWatchlist } from '../api/watchlist';

function TrendingPage() {
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, ascending: true });
  const [tableData, setTableData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [added, setAdded] = useState({});
  const [availableDates, setAvailableDates] = useState([]);
  const [checkedSymbols, setCheckedSymbols] = useState(new Set());

  useEffect(() => {
    fetchScreenDates().then(setAvailableDates).catch(() => {});
  }, []);

  const { minDate: screenMinDate, maxDate: screenMaxDate } = useMemo(
    () => getScreenDatePickerBounds(availableDates),
    [availableDates],
  );

  const handleAdd = async (symbol, listType) => {
    const key = `${symbol}_${listType}`;
    if (added[key]) return;
    try {
      await addToWatchlist(symbol.toUpperCase(), listType, '');
      setAdded(prev => ({ ...prev, [key]: true }));
    } catch (_) { /* ignore */ }
  };

  const handleAddSelected = async (listType) => {
    const syms = [...checkedSymbols].filter(Boolean);
    for (const symbol of syms) {
      // eslint-disable-next-line no-await-in-loop
      await handleAdd(symbol, listType);
    }
  };

  const formatDateParam = (d) => {
    if (!d) return null;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setLoadError(null);
    setPage(1);
    const dateStr = formatDateParam(selectedDate);
    const searchMode = String(searchTerm || '').trim().length > 0;
    const fetchLimit = searchMode ? 1000 : 50;
    const cacheKey = `trendingStocksData_${fetchLimit}${dateStr ? '_' + dateStr : ''}`;
    let cacheSet = false;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      setTableData(Array.isArray(parsed) ? parsed : []);
      setIsLoading(false);
      cacheSet = true;
    }
    fetchTrending(fetchLimit, dateStr).then((fresh) => {
      sessionStorage.setItem(cacheKey, JSON.stringify(fresh));
      if (isMounted) {
        setTableData(Array.isArray(fresh) ? fresh : []);
        setIsLoading(false);
      }
    }).catch((err) => {
      if (isMounted && !cacheSet) {
        setLoadError(err?.message || 'Failed to load trending stocks.');
        setIsLoading(false);
      }
    });
    return () => { isMounted = false; };
  }, [selectedDate, searchTerm]);

  const dataToFilter = tableData;

  const filteredData = useMemo(() => {
    const filtered = dataToFilter.filter((row) => {
      return (row.symbol || '').toLowerCase().includes(searchTerm.toLowerCase());
    });
    const seen = new Set();
    return filtered.filter((row) => {
      if (seen.has(row.symbol)) return false;
      seen.add(row.symbol);
      return true;
    });
  }, [dataToFilter, searchTerm]);

  const extractNumeric = (value, key) => {
    if (typeof value === 'number') return value;
    if (value === null || value === undefined) return 0;
    let str = value.toString().replace(/,/g, '');
    if (['ema21', 'ema50', 'cmp', 'chg'].includes(key)) str = str.replace(/[^\d.-]/g, '');
    return parseFloat(str) || 0;
  };

  const sortedData = useMemo(() => {
    if (!sortConfig.key) return filteredData;
    const sorted = [...filteredData].sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];
      if (['ema21', 'ema50', 'cmp', 'chg'].includes(sortConfig.key)) {
        aValue = extractNumeric(aValue, sortConfig.key);
        bValue = extractNumeric(bValue, sortConfig.key);
      }
      if (aValue < bValue) return sortConfig.ascending ? -1 : 1;
      if (aValue > bValue) return sortConfig.ascending ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredData, sortConfig]);

  const paginatedData = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return sortedData.slice(start, start + rowsPerPage);
  }, [sortedData, page, rowsPerPage]);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      ascending: prev.key === key ? !prev.ascending : true,
    }));
  };

  const getSortArrow = (columnKey) => {
    if (sortConfig.key !== columnKey) return ' ⬍';
    return sortConfig.ascending ? ' ↑' : ' ↓';
  };

  const columnConfig = [
    { key: 'id', label: '#' },
    { key: 'symbol', label: 'Symbol' },
    { key: 'sector', label: 'Sector' },
    { key: 'subSector', label: 'Sub Sector' },
    { key: 'mc', label: 'MC' },
    { key: 'ema21', label: 'EMA 21' },
    { key: 'ema50', label: 'EMA 50' },
    { key: 'cmp', label: 'CMP' },
    { key: 'chg', label: 'CHG%' },
  ];

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      {loadError && (
        <div style={{ marginBottom: '12px', color: '#dc3545', fontWeight: 600 }}>{loadError}</div>
      )}
      {isLoading && !loadError && (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 120 }}>
          <CircularProgress />
        </Box>
      )}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1.5}>
        <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
          <Typography variant="h6">Select Date:</Typography>
          <DatePicker
            value={selectedDate}
            onChange={(date) => setSelectedDate(date)}
            minDate={screenMinDate}
            maxDate={screenMaxDate}
            renderInput={(params) => <TextField {...params} size="small" />}
          />
        </Box>
        <TextField
          size="small"
          variant="outlined"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ minWidth: { xs: '100%', sm: 220 }, maxWidth: 320, flexGrow: { xs: 1, sm: 0 } }}
        />
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', ml: { xs: 0, md: 'auto' } }}>
          <Button size="small" variant="contained" disabled={checkedSymbols.size === 0} onClick={() => handleAddSelected('short_term')} sx={{ textTransform: 'none' }}>
            {`Add ST (${checkedSymbols.size})`}
          </Button>
          <Button size="small" variant="contained" disabled={checkedSymbols.size === 0} onClick={() => handleAddSelected('long_term')} sx={{ textTransform: 'none', bgcolor: '#2e7d32' }}>
            {`Add LT (${checkedSymbols.size})`}
          </Button>
        </Box>
      </Box>
      <TableSection>
        <TableTitle>Trending Stocks</TableTitle>
        <TableWrapper>
          <Table>
            <thead>
              <tr>
                <th style={{ width: 32 }}>
                  <Checkbox
                    size="small"
                    checked={paginatedData.length > 0 && paginatedData.every((r) => checkedSymbols.has(r.symbol))}
                    indeterminate={paginatedData.some((r) => checkedSymbols.has(r.symbol)) && !paginatedData.every((r) => checkedSymbols.has(r.symbol))}
                    onChange={() => {
                      const pageSyms = paginatedData.map((r) => r.symbol);
                      const allSelected = pageSyms.every((s) => checkedSymbols.has(s));
                      setCheckedSymbols((prev) => {
                        const next = new Set(prev);
                        if (allSelected) pageSyms.forEach((s) => next.delete(s));
                        else pageSyms.forEach((s) => next.add(s));
                        return next;
                      });
                    }}
                  />
                </th>
                {columnConfig.map((col) => (
                  <th key={col.key} onClick={() => handleSort(col.key)}>
                    {col.label}
                    {getSortArrow(col.key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((row) => (
                <tr key={row.id} className={row.chg && row.chg.startsWith('-') ? 'row-down' : 'row-up'}>
                  <td>
                    <Checkbox
                      size="small"
                      checked={checkedSymbols.has(row.symbol)}
                      onChange={() => {
                        setCheckedSymbols((prev) => {
                          const next = new Set(prev);
                          if (next.has(row.symbol)) next.delete(row.symbol);
                          else next.add(row.symbol);
                          return next;
                        });
                      }}
                    />
                  </td>
                  <td className="index">{row.id}</td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {row.symbol}
                      <a
                        href={`https://www.tradingview.com/chart/?symbol=NSE%3A${encodeURIComponent(row.symbol)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`View ${row.symbol} on TradingView`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          background: '#131722',
                          textDecoration: 'none',
                          flexShrink: 0,
                        }}
                      >
                        <svg width="10" height="10" viewBox="0 0 36 28" fill="none">
                          <path d="M14 22H7V11h7v11zm11 0h-7V6h7v16zm11 0h-7V0h7v22z" fill="#2962FF" />
                          <rect y="25" width="36" height="3" rx="1.5" fill="#2962FF" />
                        </svg>
                      </a>
                    </span>
                  </td>
                  <td>{row.sector}</td>
                  <td>{row.subSector}</td>
                  <td>{row.mc}</td>
                  <td>{row.ema21}</td>
                  <td>{row.ema50}</td>
                  <td>{row.cmp}</td>
                  <td>
                    <span className={row.chg && row.chg.startsWith('-') ? 'trend-down' : 'trend-up'}>
                      {row.chg}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Box display="flex" justifyContent="center" mt={2}>
            <Pagination
              count={Math.ceil(sortedData.length / rowsPerPage)}
              page={page}
              onChange={(_, value) => setPage(value)}
              color="primary"
            />
          </Box>
        </TableWrapper>
      </TableSection>
    </LocalizationProvider>
  );
}

export default TrendingPage;