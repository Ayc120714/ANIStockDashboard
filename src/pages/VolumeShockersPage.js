import React, { useMemo, useState, useEffect } from 'react';
import { TableSection, TableTitle, TableWrapper, Table } from './SectorOutlook.styles';
import { Box, TextField, Typography } from '@mui/material';
import Pagination from '@mui/material/Pagination';
import { CircularProgress } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { fetchVolumeShockers } from '../api/stocks';

function VolumeShockersPage() {
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, ascending: true });
  const [tableData, setTableData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setLoadError(null);
    let cacheSet = false;
    const cached = sessionStorage.getItem('volumeShockersData');
    if (cached) {
      const parsed = JSON.parse(cached);
      setTableData(Array.isArray(parsed) ? parsed : []);
      setIsLoading(false);
      cacheSet = true;
    }
    fetchVolumeShockers().then((fresh) => {
      sessionStorage.setItem('volumeShockersData', JSON.stringify(fresh));
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
  }, []);

  const defaultTableData = [
    { id: '01', symbol: 'TATACHEM', sector: 'Chemicals', subSector: 'Bulk Chemicals', mc: 'Mid Cap', volume: '2,100,000', avgVolume: '1,200,000', cmp: '₹1,050.00', chg: '8.50%', date: '2026-01-24' },
    { id: '02', symbol: 'RELIANCE', sector: 'Oil & Gas', subSector: 'Integrated Oil & Gas', mc: 'Large Cap', volume: '5,000,000', avgVolume: '3,500,000', cmp: '₹2,450.00', chg: '5.20%', date: '2026-01-23' },
    { id: '03', symbol: 'HDFCBANK', sector: 'Financial Services', subSector: 'Banking', mc: 'Large Cap', volume: '3,800,000', avgVolume: '2,900,000', cmp: '₹1,600.00', chg: '4.10%', date: '2026-01-22' },
    { id: '04', symbol: 'ADANIPORTS', sector: 'Logistics', subSector: 'Port Services', mc: 'Large Cap', volume: '1,500,000', avgVolume: '900,000', cmp: '₹800.00', chg: '6.75%', date: '2026-01-21' },
  ];

  const dataToFilter = tableData.length ? tableData : defaultTableData;

  const filteredData = useMemo(() => {
    const filtered = dataToFilter.filter((row) => {
      const matchesSearch = (row.symbol || '').toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;
      if (!selectedDate) return true;
      const rowDate = new Date(row.date);
      if (isNaN(rowDate.getTime())) return false;
      const startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      const endDate = new Date();
      return rowDate >= startDate && rowDate <= endDate;
    });
    
    // Remove duplicates - keep only first occurrence of each symbol
    const seen = new Set();
    return filtered.filter((row) => {
      if (seen.has(row.symbol)) return false;
      seen.add(row.symbol);
      return true;
    });
  }, [dataToFilter, searchTerm, selectedDate]);

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
      if (['volume', 'avgVolume', 'cmp', 'chg'].includes(sortConfig.key)) {
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
    { key: 'avgVolume', label: 'Avg.Vol' },
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
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box display="flex" alignItems="center" gap={2}>
          <Typography variant="h6">Select Date:</Typography>
          <DatePicker
            value={selectedDate}
            onChange={(date) => setSelectedDate(date)}
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
                  <td>{row.cmp}</td>
                  <td className="trend-up">{row.chg}</td>
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
