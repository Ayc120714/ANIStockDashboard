import React, { useMemo, useState } from 'react';
import { TableSection, TableTitle, TableWrapper, Table } from './SectorOutlook.styles';
import { Box, TextField } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

function IPOsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, ascending: true });

  // Demo data for IPOs
  const tableData = [
    { id: '01', symbol: 'GCSL', ema21: '-', cmp: '₹243.05', chg: '6.92%', todaysVol: '3,34,356', avgVol: '3,71,285.8', volJump: '0.9x', listDate: '04 Sep 25', listPrice: '₹280.00', percentInc: '-13.20%' },
    { id: '02', symbol: 'PICCADDIL', ema21: '₹662.26', cmp: '₹680.05', chg: '4.47%', todaysVol: '4,73,882', avgVol: '1,37,018', volJump: '3.5x', listDate: '02 Jul 25', listPrice: '₹628.95', percentInc: '8.12%' },
    { id: '03', symbol: 'SAATVIKGL', ema21: '-', cmp: '₹524.45', chg: '4.45%', todaysVol: '12,46,352', avgVol: '7,41,653', volJump: '1.7x', listDate: '26 Sep 25', listPrice: '₹465.00', percentInc: '12.78%' },
    { id: '04', symbol: 'SHANTIGOLD', ema21: '-', cmp: '₹238.19', chg: '4.22%', todaysVol: '35,55,133', avgVol: '17,83,811.6', volJump: '2.0x', listDate: '01 Aug 25', listPrice: '₹227.55', percentInc: '4.68%' },
    { id: '05', symbol: 'JARO', ema21: '-', cmp: '₹629.80', chg: '3.58%', todaysVol: '3,85,194', avgVol: '2,36,827', volJump: '1.6x', listDate: '30 Sep 25', listPrice: '₹890.00', percentInc: '-29.24%' },
    { id: '06', symbol: 'EBGNG', ema21: '-', cmp: '₹334.95', chg: '3.09%', todaysVol: '4,42,760', avgVol: '1,80,307', volJump: '2.5x', listDate: '30 Jul 25', listPrice: '₹355.00', percentInc: '-5.65%' },
    { id: '07', symbol: 'RHETAN', ema21: '-', cmp: '₹23.31', chg: '2.10%', todaysVol: '7,44,907', avgVol: '13,43,452.4', volJump: '0.6x', listDate: '26 Sep 25', listPrice: '₹21.25', percentInc: '9.69%' },
    { id: '08', symbol: 'GKENERGY', ema21: '-', cmp: '₹205.42', chg: '2.07%', todaysVol: '10,65,841', avgVol: '14,37,061.8', volJump: '0.7x', listDate: '26 Sep 25', listPrice: '₹171.00', percentInc: '20.13%' },
    { id: '09', symbol: 'URBANCO', ema21: '-', cmp: '₹157.75', chg: '2.08%', todaysVol: '76,77,863', avgVol: '64,10,465.4', volJump: '1.2x', listDate: '17 Sep 25', listPrice: '₹162.25', percentInc: '-2.77%' },
  ];

  // Filter data based on search term and selected date
  const filteredData = useMemo(() => {
    const filtered = tableData.filter((row) => {
      const matchesSearch = row.symbol.toLowerCase().includes(searchTerm.toLowerCase());
      let dateMatch = true;
      if (selectedDate) {
        // Parse listDate to Date object
        const [day, monthStr, year] = row.listDate.split(' ');
        const monthMap = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
        const rowDate = new Date(parseInt(year) + 2000, monthMap[monthStr], parseInt(day));
        dateMatch = rowDate >= new Date(selectedDate.toISOString().split('T')[0]) && rowDate <= new Date();
      }
      return matchesSearch && dateMatch;
    });
    
    // Remove duplicates - keep only first occurrence of each symbol
    const seen = new Set();
    return filtered.filter((row) => {
      if (seen.has(row.symbol)) return false;
      seen.add(row.symbol);
      return true;
    });
  }, [tableData, searchTerm, selectedDate]);

  // Numeric extraction for sorting
  const extractNumeric = (value, key) => {
    if (typeof value === 'number') return value;
    let str = value.toString().replace(/,/g, '');
    if (["cmp", "listPrice"].includes(key)) str = str.replace(/[^\d.-]/g, '');
    if (["chg", "percentInc", "volJump"].includes(key)) str = str.replace(/[^\d.-]/g, '');
    return parseFloat(str) || 0;
  };

  // Sort after filtering
  const sortedData = useMemo(() => {
    if (!sortConfig.key) return filteredData;
    const sorted = [...filteredData].sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];
      if (["cmp", "chg", "percentInc", "volJump", "listPrice"].includes(sortConfig.key)) {
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
    { key: 'ema21', label: 'EMA 21' },
    { key: 'cmp', label: 'CMP' },
    { key: 'chg', label: 'CHG%' },
    { key: 'todaysVol', label: "Today's Vol" },
    { key: 'avgVol', label: 'Avg. Vol' },
    { key: 'volJump', label: 'Vol Jump' },
    { key: 'listDate', label: 'List Date' },
    { key: 'listPrice', label: 'List Price' },
    { key: 'percentInc', label: '%Increase' },
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
        <TableTitle>IPOs</TableTitle>
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
                  <td>{row.ema21}</td>
                  <td>{row.cmp}</td>
                  <td style={{ color: row.chg.startsWith('-') ? '#1976d2' : '#388e3c' }}>{row.chg}</td>
                  <td>{row.todaysVol}</td>
                  <td>{row.avgVol}</td>
                  <td>{row.volJump}</td>
                  <td>{row.listDate}</td>
                  <td>{row.listPrice}</td>
                  <td style={{ color: row.percentInc.startsWith('-') ? '#1976d2' : '#388e3c' }}>{row.percentInc}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrapper>
      </TableSection>
    </LocalizationProvider>
  );
}

export default IPOsPage;
