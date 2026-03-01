import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { TableSection, TableTitle, TableWrapper, Table } from './SectorOutlook.styles';
import { Alert, Box, Button, CircularProgress, IconButton, MenuItem, Select, TextField } from '@mui/material';
import Pagination from '@mui/material/Pagination';
import { MdDelete } from 'react-icons/md';
import { FaSortUp, FaSortDown, FaSort } from 'react-icons/fa';
import { clearPriceAlertTriggers, deletePriceAlertTrigger, fetchPriceAlertTriggers } from '../api/priceAlerts';
import { useAuth } from '../auth/AuthContext';

const fmtRupee = (v) => {
  if (v == null || v === '' || isNaN(v)) return '—';
  return `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const compact = { fontSize: 12, padding: '4px 6px', whiteSpace: 'nowrap' };

const SORTABLE_COLS = [
  { key: 'triggered_at', label: 'Time' },
  { key: 'list_type', label: 'List' },
  { key: 'symbol', label: 'Symbol' },
  { key: 'direction', label: 'Direction' },
  { key: 'threshold_price', label: 'Threshold', numeric: true },
  { key: 'trigger_price', label: 'Triggered At', numeric: true },
  { key: 'message', label: 'Message' },
];

function StockAlertsPage() {
  const { user } = useAuth();
  const userId = String(user?.id || user?.user_id || user?.email || '');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listTypeFilter, setListTypeFilter] = useState('');
  const [symbolFilter, setSymbolFilter] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [page, setPage] = useState(1);
  const [sortCol, setSortCol] = useState('');
  const [sortDir, setSortDir] = useState('desc');
  const rowsPerPage = 25;

  const load = useCallback(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMsg('');
    fetchPriceAlertTriggers({ userId, limit: 500 })
      .then((rows) => setData(Array.isArray(rows) ? rows : []))
      .catch((e) => setErrorMsg(e?.message || 'Failed to load alert history'))
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const handleSort = (col) => {
    if (sortCol === col) {
      if (sortDir === 'desc') setSortDir('asc');
      else { setSortCol(''); setSortDir('desc'); }
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
    setPage(1);
  };

  const filteredData = useMemo(() => {
    return data.filter((row) => {
      if (listTypeFilter && String(row.list_type || '').toLowerCase() !== listTypeFilter.toLowerCase()) return false;
      if (symbolFilter && !String(row.symbol || '').toLowerCase().includes(symbolFilter.toLowerCase())) return false;
      return true;
    });
  }, [data, listTypeFilter, symbolFilter]);

  const sortedData = useMemo(() => {
    if (!sortCol) return filteredData;
    const colDef = SORTABLE_COLS.find(c => c.key === sortCol);
    const isNum = colDef?.numeric;
    return [...filteredData].sort((a, b) => {
      let va = a[sortCol], vb = b[sortCol];
      if (va == null) va = isNum ? -Infinity : '';
      if (vb == null) vb = isNum ? -Infinity : '';
      if (isNum) {
        va = Number(va) || -Infinity;
        vb = Number(vb) || -Infinity;
      } else {
        va = String(va).toLowerCase();
        vb = String(vb).toLowerCase();
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortCol, sortDir]);

  const totalPages = Math.ceil(sortedData.length / rowsPerPage);
  const paged = sortedData.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  const handleDeleteRow = async (id) => {
    if (!userId) return;
    try {
      await deletePriceAlertTrigger({ userId, triggerId: id });
      setStatusMsg('Alert history row deleted.');
      setData((prev) => prev.filter((row) => row.id !== id));
    } catch (e) {
      setErrorMsg(e?.message || 'Failed to delete alert history row');
    }
  };

  const handleClearHistory = async () => {
    if (!userId) return;
    if (!window.confirm('Clear complete alert trigger history?')) return;
    try {
      await clearPriceAlertTriggers({ userId });
      setStatusMsg('Alert history cleared.');
      setData([]);
    } catch (e) {
      setErrorMsg(e?.message || 'Failed to clear alert history');
    }
  };

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <FaSort style={{ opacity: 0.3, marginLeft: 2, fontSize: 10 }} />;
    return sortDir === 'asc'
      ? <FaSortUp style={{ color: '#1565c0', marginLeft: 2, fontSize: 10 }} />
      : <FaSortDown style={{ color: '#1565c0', marginLeft: 2, fontSize: 10 }} />;
  };

  return (
    <TableSection>
      <TableTitle>Stock Alerts</TableTitle>

      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Select size="small" value={listTypeFilter} onChange={e => { setListTypeFilter(e.target.value); setPage(1); }} displayEmpty sx={{ width: 140 }}>
          <MenuItem value="">All Lists</MenuItem>
          <MenuItem value="short_term">Short Term</MenuItem>
          <MenuItem value="long_term">Long Term</MenuItem>
        </Select>
        <TextField size="small" placeholder="Symbol…" value={symbolFilter}
          onChange={e => { setSymbolFilter(e.target.value); setPage(1); }} sx={{ width: 110 }} />
        <Box sx={{ flex: 1 }} />
        <Button size="small" variant="outlined" onClick={load} sx={{ textTransform: 'none', fontSize: 12 }}>
          Refresh
        </Button>
        <Button size="small" variant="outlined" color="error" onClick={handleClearHistory} sx={{ textTransform: 'none', fontSize: 12 }}>
          Clear History
        </Button>
      </Box>
      {statusMsg ? <Alert severity="success" sx={{ mb: 1 }}>{statusMsg}</Alert> : null}
      {errorMsg ? <Alert severity="error" sx={{ mb: 1 }}>{errorMsg}</Alert> : null}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
      ) : (
        <TableWrapper>
          <Table style={{ fontSize: 12 }}>
            <thead>
              <tr>
                {SORTABLE_COLS.map(col => (
                  <th key={col.key}
                    style={{ ...compact, cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => handleSort(col.key)}>
                    {col.label}<SortIcon col={col.key} />
                  </th>
                ))}
                <th style={compact}>Action</th>
              </tr>
            </thead>
            <tbody>
              {paged.map(a => (
                <tr key={a.id}>
                  <td style={compact}>{a.triggered_at?.replace('T', ' ').slice(0, 19) || '—'}</td>
                  <td style={{ ...compact, textTransform: 'capitalize' }}>{String(a.list_type || '—').replace('_', ' ')}</td>
                  <td style={{ ...compact, fontWeight: 600 }}>{a.symbol}</td>
                  <td style={{ ...compact, fontWeight: 600 }}>{a.direction || '—'}</td>
                  <td style={{ ...compact, fontWeight: 600, color: '#1565c0' }}>{fmtRupee(a.threshold_price)}</td>
                  <td style={{ ...compact, fontWeight: 600, color: '#2e7d32' }}>{fmtRupee(a.trigger_price)}</td>
                  <td style={{ ...compact, maxWidth: 400, whiteSpace: 'normal' }}>{a.message || '—'}</td>
                  <td style={compact}>
                    <IconButton size="small" color="error" onClick={() => handleDeleteRow(a.id)} title="Delete row">
                      <MdDelete />
                    </IconButton>
                  </td>
                </tr>
              ))}
              {paged.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 24, color: '#888' }}>
                  No alert history matching filters.
                </td></tr>
              )}
            </tbody>
          </Table>
        </TableWrapper>
      )}

      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Pagination count={totalPages} page={page} onChange={(_, v) => setPage(v)} color="primary" />
        </Box>
      )}
    </TableSection>
  );
}

export default StockAlertsPage;
