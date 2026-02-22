import React, { useMemo, useState, useEffect } from 'react';
import { TableSection, TableTitle, TableWrapper, Table } from './SectorOutlook.styles';
import { Box, TextField, Typography, IconButton, Tooltip } from '@mui/material';
import Pagination from '@mui/material/Pagination';
import { CircularProgress } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { MdPlaylistAdd, MdCheck } from 'react-icons/md';
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
  const [added, setAdded] = useState({});
  const [availableDates, setAvailableDates] = useState([]);

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
    const cacheKey = `volumeShockersData${dateStr ? '_' + dateStr : ''}`;
    let cacheSet = false;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      setTableData(Array.isArray(parsed) ? parsed : []);
      setIsLoading(false);
      cacheSet = true;
    }
    fetchVolumeShockers(50, dateStr).then((fresh) => {
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
  }, [selectedDate]);

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
      if (['volume', 'avgVolume', 'volJump', 'cmp', 'chg'].includes(sortConfig.key)) {
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
    { key: 'volume', label: "Today's Vol" },
    { key: 'avgVolume', label: 'Avg Vol' },
    { key: 'volJump', label: 'Vol Jump' },
    { key: 'cmp', label: 'CMP' },
    { key: 'chg', label: 'CHG%' },
    { key: 'actions', label: '+' },
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
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box display="flex" alignItems="center" gap={2}>
          <Typography variant="h6">Select Date:</Typography>
          <DatePicker
            value={selectedDate}
            onChange={(date) => setSelectedDate(date)}
            minDate={availableDates.length ? new Date(availableDates[availableDates.length - 1]) : undefined}
            maxDate={new Date()}
            renderInput={(params) => <TextField {...params} size="small" />}
          />
        </Box>
        <TextField
          size="small"
          variant="outlined"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </Box>
      <TableSection>
        <TableTitle>Volume Shockers</TableTitle>
        <TableWrapper>
          <Table>
            <thead>
              <tr>
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
                <tr key={row.id}>
                  <td className="index">{row.id}</td>
                  <td>{row.symbol}</td>
                  <td>{row.sector}</td>
                  <td>{row.subSector}</td>
                  <td>{row.mc}</td>
                  <td>{row.volume}</td>
                  <td>{row.avgVolume}</td>
                  <td style={{ fontWeight: 600, color: row.volJump && parseFloat(row.volJump) >= 2 ? '#d32f2f' : undefined }}>{row.volJump}</td>
                  <td>{row.cmp}</td>
                  <td className={row.chg && row.chg.startsWith('-') ? 'trend-down' : 'trend-up'}>{row.chg}</td>
                  <td>
                    <Box sx={{ display: 'flex', gap: 0.3 }}>
                      <Tooltip title={added[`${row.symbol}_short_term`] ? 'Added' : 'Short Term'}>
                        <span>
                          <IconButton size="small" disabled={!!added[`${row.symbol}_short_term`]} onClick={() => handleAdd(row.symbol, 'short_term')}
                            sx={{ p: '2px', bgcolor: added[`${row.symbol}_short_term`] ? '#e8f5e9' : '#e3f2fd', color: added[`${row.symbol}_short_term`] ? '#2e7d32' : '#1565c0', fontSize: 14 }}>
                            {added[`${row.symbol}_short_term`] ? <MdCheck /> : <MdPlaylistAdd />}
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title={added[`${row.symbol}_long_term`] ? 'Added' : 'Long Term'}>
                        <span>
                          <IconButton size="small" disabled={!!added[`${row.symbol}_long_term`]} onClick={() => handleAdd(row.symbol, 'long_term')}
                            sx={{ p: '2px', bgcolor: added[`${row.symbol}_long_term`] ? '#e8f5e9' : '#fff3e0', color: added[`${row.symbol}_long_term`] ? '#2e7d32' : '#e65100', fontSize: 14 }}>
                            {added[`${row.symbol}_long_term`] ? <MdCheck /> : <MdPlaylistAdd />}
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Box>
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