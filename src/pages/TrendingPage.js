import React, { useMemo, useState } from 'react';
import { TableSection, TableTitle, TableWrapper, Table } from './SectorOutlook.styles';
import { Box, TextField, Typography } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

function TrendingPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, ascending: true });

  const tableData = [
    { id: '01', symbol: 'NAVINFLUOR', sector: 'Chemicals', subSector: 'Bulk Chemicals', mc: 'Small Cap', ema21: '₹4,994.48', ema50: '₹4,891.23', cmp: '₹5,687.40', chg: '14.28%', date: '2025-10-31' },
    { id: '02', symbol: 'TDPOWERSYS', sector: 'Energy', subSector: 'Heavy Electrical Equipment', mc: 'Small Cap', ema21: '₹643.94', ema50: '₹597.84', cmp: '₹774.90', chg: '13.32%', date: '2025-10-31' },
    { id: '03', symbol: 'INTELLECT', sector: 'IT', subSector: 'IT Software', mc: 'Small Cap', ema21: '₹1,012.06', ema50: '₹1,006.89', cmp: '₹1,133.50', chg: '8.29%', date: '2025-10-30' },
    { id: '04', symbol: 'TATVA', sector: 'Chemicals', subSector: 'Specialty Chemicals', mc: 'Small Cap', ema21: '₹1,266.03', ema50: '₹1,164.88', cmp: '₹1,422.30', chg: '4.60%', date: '2025-10-29' },
  ];

   // Filter data based on search term and selected date
  const filteredData = tableData.filter((row) => {
    const matchesSearch = row.symbol.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDate =
      selectedDate
        ? new Date(row.date) >= new Date(selectedDate.toISOString().split('T')[0]) &&
          new Date(row.date) <= new Date()
        : true;
    return matchesSearch && matchesDate;
  });

  const extractNumeric = (value) => {
    if (typeof value === 'number') return value;
    const match = value.toString().match(/-?[\d.]+/);
    return match ? parseFloat(match[0]) : 0;
  };

  // Sort after filtering
  const sortedData = useMemo(() => {
    if (!sortConfig.key) return filteredData;

    const sorted = [...filteredData].sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      // Numeric sort for numbers / currency / percentages
      aValue = extractNumeric(aValue);
      bValue = extractNumeric(bValue);

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
    { key: 'ema21', label: 'EMA 21' },
    { key: 'ema50', label: 'EMA 50' },
    { key: 'cmp', label: 'CMP' },
    { key: 'chg', label: 'CHG%' },
  ];

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
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
      {/* Table Section */}
      <TableSection>
        <TableTitle>Trending Stocks</TableTitle>
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
              {sortedData.map((row) => (
                <tr key={row.id}>
                  <td className="index">{row.id}</td>
                  <td>{row.symbol}</td>
                  <td>{row.sector}</td>
                  <td>{row.subSector}</td>
                  <td>{row.mc}</td>
                  <td>{row.ema21}</td>
                  <td>{row.ema50}</td>
                  <td>{row.cmp}</td>
                  <td className="trend-up">{row.chg}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrapper>
      </TableSection>
    </LocalizationProvider>
  );
}

export default TrendingPage;