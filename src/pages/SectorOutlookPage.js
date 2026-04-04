import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
  TableSection,
  TableTitle,
  TableWrapper,
  Table
} from './SectorOutlook.styles';
import { Box, TextField } from '@mui/material';
import { CircularProgress } from '@mui/material';
import Pagination from '@mui/material/Pagination';
import { fetchSectorOutlook } from '../api/sectorOutlook';

const SECTOR_REFRESH_MS = 30000;

function SectorOutlookPage({ onSectorClick }) {
    const [page, setPage] = useState(1);
    const rowsPerPage = 10;
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, ascending: true });
  const [tableData, setTableData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const loadData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setIsLoading(true);
    }
    setLoadError(null);
    let cacheSet = false;
    const cached = sessionStorage.getItem('sectorOutlookData');
    if (!silent && cached) {
      const parsed = JSON.parse(cached);
      setTableData(Array.isArray(parsed) ? parsed : []);
      setIsLoading(false);
      cacheSet = true;
    }
    try {
      const fresh = await fetchSectorOutlook();
      sessionStorage.setItem('sectorOutlookData', JSON.stringify(fresh));
      setTableData(Array.isArray(fresh) ? fresh : []);
      if (!silent) {
        setIsLoading(false);
      }
    } catch (err) {
      if (!silent && !cacheSet) {
        setLoadError(err?.message || 'Failed to load sector outlook.');
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    loadData({ silent: false });
    const timer = setInterval(() => {
      if (isMounted) {
        loadData({ silent: true });
      }
    }, SECTOR_REFRESH_MS);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [loadData]);

  // Filter data based on search term
  const filteredData = tableData.filter((row) =>
  row.name.toLowerCase().includes(searchTerm.toLowerCase())
);

const extractNumeric = (value) => {
    if (typeof value === 'number') return value;
    const match = value.toString().match(/-?[\d.]+/);
    return match ? parseFloat(match[0]) : 0;
  };

  const getSectorRowClass = (row) => {
    if (row.trendDirection === 'up') return 'row-up';
    if (row.trendDirection === 'down') return 'row-down';
    return 'row-sideways';
  };

  const getSectorTrendCellClass = (row) => {
    if (row.trendDirection === 'up') return 'trend-up';
    if (row.trendDirection === 'down') return 'trend-down';
    return 'trend-sideways';
  };

  const perfCellClassName = (cell) => {
    const s = (cell ?? '').toString().trim();
    if (!s || s === '—') return '';
    return s.includes('-') ? 'trend-down' : 'trend-up';
  };

  // sort after filtering
  const sortedData = useMemo(() => {
    if (!sortConfig.key) return filteredData;
    const sorted = [...filteredData].sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];
      aValue = extractNumeric(aValue);
      bValue = extractNumeric(bValue);
      if (aValue < bValue) return sortConfig.ascending ? -1 : 1;
      if (aValue > bValue) return sortConfig.ascending ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredData, sortConfig]);

  // Pagination logic
  const paginatedData = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return sortedData.slice(start, start + rowsPerPage);
  }, [sortedData, page]);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      ascending: prev.key === key ? !prev.ascending : true
    }));
  };

  const getSortArrow = (columnKey) => {
    if (sortConfig.key !== columnKey) return ' ⬍';
    return sortConfig.ascending ? ' ↑' : ' ↓';
  };

  const columnConfig = [
  { key: 'id', label: '#' },
  { key: 'name', label: 'Index' },
  { key: 'trend', label: 'Trend' },
  { key: 'value', label: 'CMP' },
  { key: 'percentile', label: 'Percentile' },
  { key: 'day1d', label: '1D' },
  { key: 'week1w', label: '1W' },
  { key: 'month1m', label: '1M' },
  { key: 'month3m', label: '3M' },
  { key: 'month6m', label: '6M' },
  { key: 'year1y', label: '1Y' },
  { key: 'year3y', label: '3Y' },
];


  return (
    <>
    {loadError && (
      <div style={{ marginBottom: '12px', color: '#dc3545', fontWeight: 600 }}>{loadError}</div>
    )}
    {isLoading && !loadError && (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 120 }}>
        <CircularProgress />
      </Box>
    )}
    <Box display="flex" justifyContent="flex-end" mb={2}> <TextField size="small" variant="outlined" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /> </Box> 
    {/* Table Section */}
      <TableSection>
        <TableTitle>Market Indices</TableTitle>
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
                <tr key={row.id} className={getSectorRowClass(row)}>
                  <td className="index">{row.id}</td>
                  <td
                    style={{ cursor: 'pointer', color: '#007bff', textDecoration: 'underline' }}
                    onClick={() => onSectorClick && onSectorClick(row.name)}
                  >{row.name}</td>
                  <td className={getSectorTrendCellClass(row)}>{row.trend}</td>
                  <td>{row.value}</td>
                  <td><span className="percentage">{row.percentile}</span></td>
                  <td className={perfCellClassName(row.day1d)}>{row.day1d}</td>
                  <td className={perfCellClassName(row.week1w)}>{row.week1w}</td>
                  <td className={perfCellClassName(row.month1m)}>{row.month1m}</td>
                  <td className={perfCellClassName(row.month3m)}>{row.month3m}</td>
                  <td className={perfCellClassName(row.month6m)}>{row.month6m}</td>
                  <td className={perfCellClassName(row.year1y)}>{row.year1y}</td>
                  <td className={perfCellClassName(row.year3y)}>{row.year3y}</td>
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
    </>
  );
}

export default SectorOutlookPage;