import React, { useMemo, useState, useEffect } from 'react';
import { TableSection, TableTitle, TableWrapper, Table } from './SectorOutlook.styles';
import { Box, TextField, ButtonGroup, Button, CircularProgress, Checkbox } from '@mui/material';
import Pagination from '@mui/material/Pagination';
import { fetchIPOs } from '../api/stocks';
import { addToWatchlist } from '../api/watchlist';

const formatNum = (v) => {
  if (v == null || v === '') return '—';
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
  return isNaN(n) ? v : n.toLocaleString('en-IN');
};

const formatCurrency = (v) => {
  if (v == null) return '—';
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.-]/g, ''));
  return isNaN(n) ? String(v) : `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatSubscription = (v) => {
  if (v == null || v === '') return '—';
  const n = parseFloat(v);
  return isNaN(n) ? v : `${n.toFixed(2)}x`;
};

const formatGain = (v) => {
  if (v == null) return '—';
  const n = typeof v === 'number' ? v : parseFloat(v);
  if (isNaN(n)) return '—';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
};

function IPOsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, ascending: true });
  const [tableData, setTableData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [page, setPage] = useState(1);
  const rowsPerPage = 15;
  const [added, setAdded] = useState({});
  const [checkedSymbols, setCheckedSymbols] = useState(new Set());

  const handleAdd = async (symbol, listType) => {
    if (!symbol || symbol === '—') return;
    const key = `${symbol}_${listType}`;
    if (added[key]) return;
    try {
      await addToWatchlist(symbol.toUpperCase(), listType, '');
      setAdded(prev => ({ ...prev, [key]: true }));
    } catch (_) { /* ignore */ }
  };

  const handleAddSelected = async (listType) => {
    const syms = [...checkedSymbols].filter((s) => s && s !== '—');
    for (const symbol of syms) {
      // eslint-disable-next-line no-await-in-loop
      await handleAdd(symbol, listType);
    }
  };

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setLoadError(null);
    setPage(1);
    fetchIPOs(statusFilter, 200)
      .then((data) => {
        if (!isMounted) return;
        const mapped = data.map((ipo, idx) => ({
          id: String(idx + 1).padStart(2, '0'),
          symbol: ipo.symbol || '—',
          companyName: ipo.company_name || '—',
          series: ipo.series || '—',
          issueStartDate: ipo.issue_start_date || '—',
          issueEndDate: ipo.issue_end_date || '—',
          status: ipo.status || '—',
          issuePrice: ipo.issue_price || '—',
          issueSize: formatNum(ipo.issue_size),
          sharesBid: formatNum(ipo.no_of_shares_bid),
          subscription: formatSubscription(ipo.subscription_times),
          listingDate: ipo.listing_date || '—',
          listingPrice: ipo.listing_price != null ? formatCurrency(ipo.listing_price) : '—',
          listingGain: formatGain(ipo.listing_gain),
          currentPrice: ipo.current_price != null ? formatCurrency(ipo.current_price) : '—',
          isSme: ipo.is_sme ? 'SME' : '',
          _rawSubscription: parseFloat(ipo.subscription_times) || 0,
          _rawListingGain: ipo.listing_gain ?? 0,
        }));
        setTableData(mapped);
        setIsLoading(false);
      })
      .catch((err) => {
        if (isMounted) {
          setLoadError(err?.message || 'Failed to load IPO data.');
          setIsLoading(false);
        }
      });
    return () => { isMounted = false; };
  }, [statusFilter]);

  const filteredData = useMemo(() => {
    if (!searchTerm) return tableData;
    const term = searchTerm.toLowerCase();
    return tableData.filter(
      (row) =>
        row.symbol.toLowerCase().includes(term) ||
        row.companyName.toLowerCase().includes(term)
    );
  }, [tableData, searchTerm]);

  const extractNumeric = (value, key) => {
    if (typeof value === 'number') return value;
    if (key === '_rawSubscription' || key === '_rawListingGain') return value || 0;
    const str = String(value || '').replace(/[₹,%+x\s]/g, '').replace(/,/g, '');
    return parseFloat(str) || 0;
  };

  const sortedData = useMemo(() => {
    if (!sortConfig.key) return filteredData;
    const sorted = [...filteredData].sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      if (['listingPrice', 'currentPrice', 'subscription', 'listingGain', 'issueSize', 'sharesBid'].includes(sortConfig.key)) {
        if (sortConfig.key === 'subscription') {
          aVal = a._rawSubscription; bVal = b._rawSubscription;
        } else if (sortConfig.key === 'listingGain') {
          aVal = a._rawListingGain; bVal = b._rawListingGain;
        } else {
          aVal = extractNumeric(aVal, sortConfig.key);
          bVal = extractNumeric(bVal, sortConfig.key);
        }
      }
      if (aVal < bVal) return sortConfig.ascending ? -1 : 1;
      if (aVal > bVal) return sortConfig.ascending ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredData, sortConfig]);

  const paginatedData = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return sortedData.slice(start, start + rowsPerPage);
  }, [sortedData, page]);

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
    { key: 'companyName', label: 'Company' },
    { key: 'series', label: 'Series' },
    { key: 'issuePrice', label: 'Issue Price' },
    { key: 'subscription', label: 'Subscription' },
    { key: 'issueStartDate', label: 'Open Date' },
    { key: 'issueEndDate', label: 'Close Date' },
    { key: 'status', label: 'Status' },
    { key: 'listingDate', label: 'List Date' },
    { key: 'listingPrice', label: 'List Price' },
    { key: 'listingGain', label: 'List Gain' },
    { key: 'currentPrice', label: 'CMP' },
  ];

  return (
    <>
      {isLoading && !loadError && (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 120 }}>
          <CircularProgress />
        </Box>
      )}
      {loadError && (
        <div style={{ marginBottom: '12px', color: '#dc3545', fontWeight: 600 }}>{loadError}</div>
      )}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ButtonGroup size="small" variant="outlined">
            {[
              { label: 'All', value: null },
              { label: 'Active', value: 'Active' },
              { label: 'Listed', value: 'Listed' },
              { label: 'Closed', value: 'Closed' },
            ].map((btn) => (
              <Button
                key={btn.label}
                variant={statusFilter === btn.value ? 'contained' : 'outlined'}
                onClick={() => setStatusFilter(btn.value)}
              >
                {btn.label}
              </Button>
            ))}
          </ButtonGroup>
          <Button size="small" variant="contained" disabled={checkedSymbols.size === 0} onClick={() => handleAddSelected('short_term')} sx={{ textTransform: 'none' }}>
            {`Add ST (${checkedSymbols.size})`}
          </Button>
          <Button size="small" variant="contained" disabled={checkedSymbols.size === 0} onClick={() => handleAddSelected('long_term')} sx={{ textTransform: 'none', bgcolor: '#2e7d32' }}>
            {`Add LT (${checkedSymbols.size})`}
          </Button>
        </Box>
        <TextField size="small" variant="outlined" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </Box>
      <TableSection>
        <TableTitle>IPOs ({sortedData.length})</TableTitle>
        <TableWrapper>
          <Table>
            <thead>
              <tr>
                <th style={{ width: 32 }}>
                  <Checkbox
                    size="small"
                    checked={paginatedData.filter((r) => r.symbol && r.symbol !== '—').length > 0 && paginatedData.filter((r) => r.symbol && r.symbol !== '—').every((r) => checkedSymbols.has(r.symbol))}
                    indeterminate={paginatedData.some((r) => r.symbol && r.symbol !== '—' && checkedSymbols.has(r.symbol)) && !paginatedData.filter((r) => r.symbol && r.symbol !== '—').every((r) => checkedSymbols.has(r.symbol))}
                    onChange={() => {
                      const pageSyms = paginatedData.map((r) => r.symbol).filter((s) => s && s !== '—');
                      const allSelected = pageSyms.length > 0 && pageSyms.every((s) => checkedSymbols.has(s));
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
                  <th key={col.key} onClick={() => handleSort(col.key)} style={{ cursor: 'pointer' }}>
                    {col.label}{getSortArrow(col.key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!isLoading && paginatedData.length === 0 && (
                <tr>
                  <td colSpan={columnConfig.length} style={{ textAlign: 'center', padding: '32px', color: '#888' }}>
                    No IPO data available.
                  </td>
                </tr>
              )}
              {paginatedData.map((row) => (
                <tr key={row.id + row.symbol}>
                  <td>
                    <Checkbox
                      size="small"
                      disabled={!row.symbol || row.symbol === '—'}
                      checked={!!row.symbol && row.symbol !== '—' && checkedSymbols.has(row.symbol)}
                      onChange={() => {
                        if (!row.symbol || row.symbol === '—') return;
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
                  <td>{row.symbol}</td>
                  <td>{row.companyName}</td>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: 10,
                      fontSize: 11,
                      fontWeight: 600,
                      background: row.series === 'EQ' ? '#e3f2fd' : row.series === 'SME' ? '#fff3e0' : '#f3e5f5',
                      color: row.series === 'EQ' ? '#1565c0' : row.series === 'SME' ? '#e65100' : '#7b1fa2',
                    }}>
                      {row.series}
                    </span>
                  </td>
                  <td>{row.issuePrice}</td>
                  <td style={{
                    color: row._rawSubscription >= 1 ? '#388e3c' : '#d32f2f',
                    fontWeight: 600,
                  }}>
                    {row.subscription}
                  </td>
                  <td>{row.issueStartDate}</td>
                  <td>{row.issueEndDate}</td>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: 10,
                      fontSize: 11,
                      fontWeight: 600,
                      background: row.status === 'Active' ? '#e8f5e9' : row.status === 'Listed' ? '#e3f2fd' : '#fafafa',
                      color: row.status === 'Active' ? '#2e7d32' : row.status === 'Listed' ? '#1565c0' : '#616161',
                    }}>
                      {row.status}
                    </span>
                  </td>
                  <td>{row.listingDate}</td>
                  <td>{row.listingPrice}</td>
                  <td style={{
                    color: row._rawListingGain > 0 ? '#388e3c' : row._rawListingGain < 0 ? '#d32f2f' : undefined,
                    fontWeight: 600,
                  }}>
                    {row.listingGain}
                  </td>
                  <td>{row.currentPrice}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          {sortedData.length > rowsPerPage && (
            <Box display="flex" justifyContent="center" mt={2}>
              <Pagination
                count={Math.ceil(sortedData.length / rowsPerPage)}
                page={page}
                onChange={(_, value) => setPage(value)}
                color="primary"
              />
            </Box>
          )}
        </TableWrapper>
      </TableSection>
    </>
  );
}

export default IPOsPage;
