import React, { useMemo, useState } from 'react';
import { TableSection, TableTitle, TableWrapper, Table } from './SectorOutlook.styles';
import { Box, TextField,  ButtonGroup, Button } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

function PriceShockersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, ascending: true });
  const [timeFrame, setTimeFrame] = useState('Day');

  // Add a date property to each row for demo purposes
  // Dates are spread across Jan 2026 for demo; adjust as needed
  const tableData = [
    { id: '01', symbol: 'MUFIN', sector: 'Financial Services', subSector: 'Finance - Investment', mc: 'Small Cap', cmp: '₹117.73', chg: '19.43%', date: new Date('2026-01-24') },
    { id: '02', symbol: 'NAVINFLUOR', sector: 'Chemicals', subSector: 'Bulk Chemicals', mc: 'Small Cap', cmp: '₹5,687.40', chg: '14.28%', date: new Date('2026-01-24') },
    { id: '03', symbol: 'TDPOWERSYS', sector: 'Energy', subSector: 'Heavy Electrical Equipment', mc: 'Small Cap', cmp: '₹774.90', chg: '13.32%', date: new Date('2026-01-23') },
    { id: '04', symbol: 'TARC', sector: 'Realty', subSector: 'Real Estate', mc: 'Small Cap', cmp: '₹159.21', chg: '11.24%', date: new Date('2026-01-22') },
    { id: '05', symbol: 'CHENNPETRO', sector: 'Oil and Gas', subSector: 'Oil & Gas', mc: 'Small Cap', cmp: '₹979.35', chg: '10.66%', date: new Date('2026-01-20') },
    { id: '06', symbol: 'STAR', sector: 'Pharma', subSector: 'Pharmaceuticals - Small', mc: 'Small Cap', cmp: '₹934.70', chg: '9.66%', date: new Date('2026-01-18') },
    { id: '07', symbol: 'RPEL', sector: 'Consumption', subSector: 'Consumer Discretionary', mc: 'Small Cap', cmp: '₹781.65', chg: '9.21%', date: new Date('2026-01-17') },
    { id: '08', symbol: 'GARUDA', sector: 'Core Housing', subSector: 'Infra & Construction', mc: 'Small Cap', cmp: '₹216.64', chg: '9.11%', date: new Date('2026-01-16') },
    { id: '09', symbol: 'INTELLECT', sector: 'IT', subSector: 'IT Software', mc: 'Small Cap', cmp: '₹1,133.50', chg: '8.29%', date: new Date('2026-01-15') },
  ];


  // Helper functions for date filtering
  const isSameDay = (d1, d2) => d1 && d2 && d1.getDate() === d2.getDate() && d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();
  const isSameWeek = (d1, d2) => {
    if (!d1 || !d2) return false;
    const startOfWeek = (date) => {
      const d = new Date(date);
      d.setDate(d.getDate() - d.getDay()); // Sunday as first day
      d.setHours(0, 0, 0, 0);
      return d;
    };
    return startOfWeek(d1).getTime() === startOfWeek(d2).getTime();
  };
  const isSameMonth = (d1, d2) => d1 && d2 && d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();

  // Filter data based on search term, selected date, and time frame
  const filteredData = tableData.filter((row) => {
    const matchesSearch = row.symbol.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    if (!selectedDate) return true;
    if (timeFrame === 'Day') return isSameDay(row.date, selectedDate);
    if (timeFrame === 'Week') return isSameWeek(row.date, selectedDate);
    if (timeFrame === 'Month') return isSameMonth(row.date, selectedDate);
    return true;
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
    { key: 'cmp', label: 'CMP' },
    { key: 'chg', label: 'CHG%' },
  ];

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box display="flex" alignItems="center" gap={2}>
          {/* Date Picker and Time Frame Buttons */}
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
              variant={timeFrame === 'Day' ? 'contained' : 'outlined'}
              onClick={() => setTimeFrame('Day')}
            >
              Day
            </Button>
            <Button
              variant={timeFrame === 'Week' ? 'contained' : 'outlined'}
              onClick={() => setTimeFrame('Week')}
            >
              Week
            </Button>
            <Button
              variant={timeFrame === 'Month' ? 'contained' : 'outlined'}
              onClick={() => setTimeFrame('Month')}
            >
              Month
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
        <TableTitle>Price Shockers</TableTitle>
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

export default PriceShockersPage;