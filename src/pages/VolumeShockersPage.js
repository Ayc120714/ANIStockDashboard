import React, { useMemo, useState } from 'react';
import { TableSection, TableTitle, TableWrapper, Table } from './SectorOutlook.styles';
import { Box, TextField, Typography } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

function VolumeShockersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, ascending: true });

  // Demo data for volume shockers
  const tableData = [
    { id: '01', symbol: 'TATACHEM', sector: 'Chemicals', subSector: 'Bulk Chemicals', mc: 'Mid Cap', volume: '2,100,000', avgVolume: '1,200,000', cmp: '₹1,050.00', chg: '8.50%', date: '2026-01-24' },
    { id: '02', symbol: 'RELIANCE', sector: 'Oil & Gas', subSector: 'Integrated Oil & Gas', mc: 'Large Cap', volume: '5,000,000', avgVolume: '3,500,000', cmp: '₹2,450.00', chg: '5.20%', date: '2026-01-23' },
    { id: '03', symbol: 'HDFCBANK', sector: 'Financial Services', subSector: 'Banking', mc: 'Large Cap', volume: '3,800,000', avgVolume: '2,900,000', cmp: '₹1,600.00', chg: '4.10%', date: '2026-01-22' },
    { id: '04', symbol: 'ADANIPORTS', sector: 'Logistics', subSector: 'Port Services', mc: 'Large Cap', volume: '1,500,000', avgVolume: '900,000', cmp: '₹800.00', chg: '6.75%', date: '2026-01-21' },
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

  // Improved numeric extraction for sorting
  const extractNumeric = (value, key) => {
    if (typeof value === 'number') return value;
    let str = value.toString().replace(/,/g, '');
    // Remove currency symbol for CMP
    if (key === 'cmp') str = str.replace(/[^\d.-]/g, '');
    // Remove percent for CHG%
    if (key === 'chg') str = str.replace(/[^\d.-]/g, '');
    return parseFloat(str) || 0;
  };

  // Sort after filtering
  const sortedData = useMemo(() => {
    if (!sortConfig.key) return filteredData;

    const sorted = [...filteredData].sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      // Numeric sort for specific columns
      if (["volume", "avgVolume", "cmp", "chg"].includes(sortConfig.key)) {
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
    { key: 'volume', label: "Today's Vol" },
    { key: 'avgVolume', label: 'Avg.Vol' },
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
              {sortedData.map((row) => (
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
        </TableWrapper>
      </TableSection>
    </LocalizationProvider>
  );
}

export default VolumeShockersPage;
