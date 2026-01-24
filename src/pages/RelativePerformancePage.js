import React, { useMemo, useState } from 'react';
import { TableSection, TableTitle, TableWrapper, Table } from './SectorOutlook.styles';
import { Box, TextField, ButtonGroup, Button } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

function RelativePerformancePage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, ascending: true });
  const [timeFrame, setTimeFrame] = useState('Short Term');

  // Demo data for relative performance
  // Dates: some <6 months (short term), some >=6 months (long term)
  const tableData = [
    // Short Term (<6 months from Jan 24, 2026)
    { id: '01', symbol: 'NACLIND', sector: 'Chemicals', subSector: 'Agri Inputs', mc: 'Small Cap', cmp: '₹269.60', chg: '-2.97%', rs: '327.58%', date: new Date('2026-01-24') },
    { id: '02', symbol: 'SMLISUZU', sector: 'Auto', subSector: 'Automobiles', mc: 'Small Cap', cmp: '₹4,086.60', chg: '-2.64%', rs: '247.76%', date: new Date('2025-12-15') },
    { id: '03', symbol: 'KRISHANA', sector: 'Chemicals', subSector: 'Agri Inputs', mc: 'Small Cap', cmp: '₹589.30', chg: '2.02%', rs: '167.85%', date: new Date('2025-10-01') },
    // Long Term (>=6 months from Jan 24, 2026)
    { id: '04', symbol: 'FORCEMOT', sector: 'Auto', subSector: 'Automobiles', mc: 'Small Cap', cmp: '₹19,092.00', chg: '-1.98%', rs: '157.13%', date: new Date('2025-07-10') },
    { id: '05', symbol: 'GABRIEL', sector: 'Auto', subSector: 'Automotive - OEM', mc: 'Small Cap', cmp: '₹1,229.40', chg: '6.68%', rs: '138.11%', date: new Date('2025-06-24') },
    { id: '06', symbol: 'PARADEEP', sector: 'Chemicals', subSector: 'Agri Inputs', mc: 'Small Cap', cmp: '₹228.23', chg: '4.97%', rs: '136.00%', date: new Date('2025-05-15') },
    { id: '07', symbol: 'CUPID', sector: 'FMCG', subSector: 'Consumer Staples', mc: 'Small Cap', cmp: '₹172.61', chg: '0.19%', rs: '127.96%', date: new Date('2025-04-01') },
    { id: '08', symbol: 'LUMAXTECH', sector: 'Auto', subSector: 'Auto Components', mc: 'Small Cap', cmp: '₹1,240.90', chg: '5.64%', rs: '122.91%', date: new Date('2025-03-10') },
    { id: '09', symbol: 'APOLLO', sector: 'Defence', subSector: 'Defence & Aerospace', mc: 'Small Cap', cmp: '₹269.60', chg: '1.45%', rs: '118.58%', date: new Date('2024-12-24') },
  ];


  // Filter data based on search term, short/long term, and selected date
  const filteredData = tableData.filter((row) => {
    const matchesSearch = row.symbol.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    // Calculate months difference from current date
    const now = new Date();
    const rowDate = row.date;
    const monthsDiff = (now.getFullYear() - rowDate.getFullYear()) * 12 + (now.getMonth() - rowDate.getMonth());
    let termMatch = false;
    if (timeFrame === 'Short Term') {
      termMatch = monthsDiff < 6;
    } else if (timeFrame === 'Long Term') {
      termMatch = monthsDiff >= 6;
    } else {
      termMatch = true;
    }
    // Date picker filter: show rows where row date falls between selected date and current date
    let dateMatch = true;
    if (selectedDate) {
      const startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      dateMatch = rowDate >= startDate && rowDate <= endDate;
    }
    return termMatch && dateMatch;
  });

  // Numeric extraction for sorting
  const extractNumeric = (value, key) => {
    if (typeof value === 'number') return value;
    let str = value.toString().replace(/,/g, '');
    if (key === 'cmp') str = str.replace(/[^\d.-]/g, '');
    if (key === 'chg' || key === 'rs') str = str.replace(/[^\d.-]/g, '');
    return parseFloat(str) || 0;
  };

  // Sort after filtering
  const sortedData = useMemo(() => {
    if (!sortConfig.key) return filteredData;
    const sorted = [...filteredData].sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];
      if (["cmp", "chg", "rs"].includes(sortConfig.key)) {
        aValue = extractNumeric(aValue, sortConfig.key);
        bValue = extractNumeric(bValue, sortConfig.key);
      }
      if (aValue < bValue) return sortConfig.ascending ? -1 : 1;
      if (aValue > bValue) return sortConfig.ascending ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredData, sortConfig]);

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
    { key: 'cmp', label: 'CMP' },
    { key: 'chg', label: 'CHG%' },
    { key: 'rs', label: 'RS%' },
  ];

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box display="flex" alignItems="center" gap={2}>
          <DatePicker
            label="Select Date"
            value={selectedDate}
            onChange={(date) => setSelectedDate(date)}
            inputFormat="dd/MM/yyyy"
            renderInput={(params) => (
              <TextField size="small" variant="outlined" {...params} style={{ minWidth: 120, background: '#fff' }} />
            )}
          />
          <ButtonGroup size="small" variant="outlined" sx={{ ml: 2 }}>
            <Button
              variant={timeFrame === 'Short Term' ? 'contained' : 'outlined'}
              onClick={() => setTimeFrame('Short Term')}
            >
              SHORT TERM
            </Button>
            <Button
              variant={timeFrame === 'Long Term' ? 'contained' : 'outlined'}
              onClick={() => setTimeFrame('Long Term')}
            >
              LONG TERM
            </Button>
          </ButtonGroup>
        </Box>
        <TextField
          size="small"
          variant="outlined"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </Box>
      {/* Table Section */}
      <TableSection>
        <TableTitle>Relative Performance</TableTitle>
        <TableWrapper>
          <Table>
            <thead>
              <tr>
                {columnConfig.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                  >
                    {col.label}
                    {getSortArrow(col.key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedData.map((row) => (
                <tr key={row.id}>
                  <td className="index">{row.id}</td>
                  <td>{row.symbol}</td>
                  <td>{row.sector}</td>
                  <td>{row.subSector}</td>
                  <td>{row.mc}</td>
                  <td>{row.cmp}</td>
                  <td style={{ color: row.chg.startsWith('-') ? '#1976d2' : '#388e3c' }}>{row.chg}</td>
                  <td style={{ color: '#388e3c' }}>{row.rs}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrapper>
      </TableSection>
    </LocalizationProvider>
  );
}

export default RelativePerformancePage;
