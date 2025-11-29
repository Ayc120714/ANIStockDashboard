import React, { useMemo, useState } from 'react';
import {
  TableSection,
  TableTitle,
  TableWrapper,
  Table
} from './SectorOutlook.styles';
import { Box, TextField } from '@mui/material';



function SectorOutlookPage() {
     const [searchTerm, setSearchTerm] = useState('');
     const [sortConfig, setSortConfig] = useState({ key: null, ascending: true });


  const tableData = [
    { id: '01', name: 'MICROCAP250', trend: '↘', value: '₹23,455.35', percentile: '58%', day1d: '↘ -1.69%', week1w: '↘ -1.73%', month1m: '↗ 0.05%', month3m: '↘ -0.97%', month6m: '↗ 11.99%', year1y: '↘ -3.61%', year3y: '↗ 29.07%' },
    { id: '02', name: 'SMALLCAP100', trend: '↘', value: '₹18,105.00', percentile: '69%', day1d: '↘ -1.39%', week1w: '↘ -1.97%', month1m: '↗ 0.99%', month3m: '↗ 1.18%', month6m: '↗ 10.28%', year1y: '↘ -1.55%', year3y: '↗ 23.31%' },
    { id: '03', name: 'NEXT50', trend: '↗', value: '₹69,299.55', percentile: '75%', day1d: '↘ -1.24%', week1w: '↘ -1.12%', month1m: '↗ 1.03%', month3m: '↗ 3.56%', month6m: '↗ 8.05%', year1y: '↘ -1.38%', year3y: '↗ 18.23%' },
    { id: '04', name: 'MIDCAP100', trend: '↗', value: '₹59,468.60', percentile: '93%', day1d: '↘ -0.95%', week1w: '↘ -1.04%', month1m: '↗ 2.51%', month3m: '↗ 3.55%', month6m: '↗ 9.54%', year1y: '↗ 5.55%', year3y: '↗ 24.27%' }
  ];

  // Filter data based on search term
  const filteredData = tableData.filter((row) =>
  row.name.toLowerCase().includes(searchTerm.toLowerCase())
);

const extractNumeric = (value) => {
    if (typeof value === 'number') return value;
    const match = value.toString().match(/-?[\d.]+/);
    return match ? parseFloat(match[0]) : 0;
  };

  // sort after filtering
  const sortedData = useMemo(() => {
    if (!sortConfig.key) return filteredData;

    const sorted = [...filteredData].sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      // numeric sort for numbers / currency / percentages
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
              {sortedData.map((row) => ( 
                <tr key={row.id}>
                  <td className="index">{row.id}</td>
                  <td>{row.name}</td>
                  <td className={row.trend === '↗' ? 'trend-up' : 'trend-down'}>{row.trend}</td>
                  <td>{row.value}</td>
                  <td><span className="percentage">{row.percentile}</span></td>
                  <td className="trend-down">{row.day1d}</td>
                  <td className="trend-down">{row.week1w}</td>
                  <td className="trend-up">{row.month1m}</td>
                  <td className="trend-up">{row.month3m}</td>
                  <td className="trend-up">{row.month6m}</td>
                  <td className={row.year1y.includes('↗') ? 'trend-up' : 'trend-down'}>{row.year1y}</td>
                  <td className="trend-up">{row.year3y}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrapper>
      </TableSection>
    </>
  );
}

export default SectorOutlookPage;