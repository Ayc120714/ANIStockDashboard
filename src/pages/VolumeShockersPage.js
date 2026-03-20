import React, { useMemo, useState, useEffect } from 'react';
import { TableSection, TableTitle, TableWrapper, Table } from './SectorOutlook.styles';
import { Box, TextField, ButtonGroup, Button, Checkbox } from '@mui/material';
import Pagination from '@mui/material/Pagination';
import { CircularProgress } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { fetchVolumeShockers, fetchScreenDates } from '../api/stocks';
import { addToWatchlist } from '../api/watchlist';

function VolumeShockersPage() {
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, ascending: true });
  const [tableData, setTableData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [timeFrame, setTimeFrame] = useState('Day');
  const [added, setAdded] = useState({});
  const [availableDates, setAvailableDates] = useState([]);
  const [checkedSymbols, setCheckedSymbols] = useState(new Set());

  useEffect(() => {
    fetchScreenDates().then(setAvailableDates).catch(() => {});
  }, []);

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
    const period = timeFrame === 'Week' ? 'week' : timeFrame === 'Month' ? 'month' : 'day';
    const dateStr = formatDateParam(selectedDate);
    const searchMode = String(searchTerm || '').trim().length > 0;
    const fetchLimit = searchMode ? 200 : 50;
    const cacheKey = `volumeShockersData_${period}_${fetchLimit}${dateStr ? '_' + dateStr : ''}`;
    let cacheSet = false;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      setTableData(Array.isArray(parsed) ? parsed : []);
      setIsLoading(false);
      cacheSet = true;
    }
    fetchVolumeShockers(fetchLimit, period, dateStr).then((fresh) => {
      sessionStorage.setItem(cacheKey, JSON.stringify(fresh));
      if (isMounted) {
        setTableData(Array.isArray(fresh) ? fresh : []);
        setIsLoading(false);
      }
    }).catch((err) => {
      if (isMounted && !cacheSet) {
        setLoadError(err?.message || 'Failed to load volume shockers.');
        setIsLoading(false);
      }
    });
    return () => { isMounted = false; };
  }, [timeFrame, selectedDate, searchTerm]);

  const defaultTableData = [
    { id: '01', symbol: 'TATACHEM', sector: 'Chemicals', subSector: 'Bulk Chemicals', mc: 'Mid Cap', volume: '2,100,000', avgVolume: '1,200,000', cmp: '₹1,050.00', chg: '8.50%', date: '2026-01-24' },
    { id: '02', symbol: 'RELIANCE', sector: 'Oil & Gas', subSector: 'Integrated Oil & Gas', mc: 'Large Cap', volume: '5,000,000', avgVolume: '3,500,000', cmp: '₹2,450.00', chg: '5.20%', date: '2026-01-23' },
    { id: '03', symbol: 'HDFCBANK', sector: 'Financial Services', subSector: 'Banking', mc: 'Large Cap', volume: '3,800,000', avgVolume: '2,900,000', cmp: '₹1,600.00', chg: '4.10%', date: '2026-01-22' },
    { id: '04', symbol: 'ADANIPORTS', sector: 'Logistics', subSector: 'Port Services', mc: 'Large Cap', volume: '1,500,000', avgVolume: '900,000', cmp: '₹800.00', chg: '6.75%', date: '2026-01-21' },
  ];

  const dataToFilter = tableData.length ? tableData : defaultTableData;

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
    if (key === 'cmp' || key === 'chg') str = str.replace(/[^\d.-]/g, '');
    return parseFloat(str) || 0;
  };

  const sortedData = useMemo(() => {
    if (!sortConfig.key) return filteredData;
    const sorted = [...filteredData].sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];
      if (sortConfig.key === 'volChgPct') {
        aValue = a.volChgRaw ?? 0;
        bValue = b.volChgRaw ?? 0;
      } else if (['volume', 'avgVolume', 'volJump', 'cmp', 'chg'].includes(sortConfig.key)) {
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

  const periodLabel = timeFrame === 'Week' ? 'Weekly' : timeFrame === 'Month' ? 'Monthly' : 'Daily';
  const columnConfig = [
    { key: 'id', label: '#' },
    { key: 'symbol', label: 'Symbol' },
    { key: 'sector', label: 'Sector' },
    { key: 'subSector', label: 'Sub Sector' },
    { key: 'mc', label: 'MC' },
    { key: 'volume', label: "Today's Vol" },
    { key: 'avgVolume', label: 'Avg Vol' },
    { key: 'volJump', label: 'Vol Jump' },
    { key: 'volChgPct', label: `Vol ${periodLabel} %` },
    { key: 'cmp', label: 'CMP' },
    { key: 'chg', label: `${periodLabel} CHG%` },
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
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={2}>
        <Box display="flex" alignItems="center" gap={2}>
          <DatePicker
            value={selectedDate}
            onChange={(date) => setSelectedDate(date)}
            minDate={availableDates.length ? new Date(availableDates[availableDates.length - 1]) : undefined}
            maxDate={new Date()}
            slotProps={{ textField: { size: 'small', placeholder: 'Select Date' } }}
          />
          <ButtonGroup variant="contained" size="small">
            {['Day', 'Week', 'Month'].map(tf => (
              <Button key={tf} onClick={() => { setTimeFrame(tf); setPage(1); }}
                sx={{
                  bgcolor: timeFrame === tf ? '#1565c0' : '#e0e0e0',
                  color: timeFrame === tf ? '#fff' : '#333',
                  fontWeight: timeFrame === tf ? 700 : 500,
                  textTransform: 'uppercase', fontSize: 12, px: 2,
                  '&:hover': { bgcolor: timeFrame === tf ? '#0d47a1' : '#bdbdbd' },
                }}>
                {tf}
              </Button>
            ))}
          </ButtonGroup>
        </Box>
        <TextField
          size="small"
          variant="outlined"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ minWidth: { xs: '100%', sm: 220 }, maxWidth: 320, flexGrow: { xs: 1, sm: 0 } }}
        />
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button size="small" variant="contained" disabled={checkedSymbols.size === 0} onClick={() => handleAddSelected('short_term')} sx={{ textTransform: 'none' }}>
            {`Add ST (${checkedSymbols.size})`}
          </Button>
          <Button size="small" variant="contained" disabled={checkedSymbols.size === 0} onClick={() => handleAddSelected('long_term')} sx={{ textTransform: 'none', bgcolor: '#2e7d32' }}>
            {`Add LT (${checkedSymbols.size})`}
          </Button>
        </Box>
      </Box>
      <TableSection>
        <TableTitle>Volume movers</TableTitle>
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
                  <td>{row.volume}</td>
                  <td>{row.avgVolume}</td>
                  <td style={{ fontWeight: 600, color: row.volJump && parseFloat(row.volJump) >= 2 ? '#d32f2f' : undefined }}>{row.volJump}</td>
                  <td style={{ fontWeight: 600, color: row.volChgRaw > 0 ? '#1b5e20' : row.volChgRaw < 0 ? '#c62828' : undefined }}>{row.volChgPct || '—'}</td>
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

export default VolumeShockersPage;