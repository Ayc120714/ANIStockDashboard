import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { TableSection, TableTitle, TableWrapper, Table } from './SectorOutlook.styles';
import { Box, TextField, Button, IconButton, Chip, CircularProgress, Autocomplete, Checkbox } from '@mui/material';
import Pagination from '@mui/material/Pagination';
import { MdClose, MdDeleteSweep, MdSelectAll, MdRefresh } from 'react-icons/md';
import { fetchWatchlist, addToWatchlist, bulkDeleteFromWatchlist } from '../api/watchlist';
import { apiGet } from '../api/apiClient';
import { useAuth } from '../auth/AuthContext';

const recColors = {
  strong_buy: '#1b5e20', buy: '#2e7d32', hold: '#f57f17',
  sell: '#c62828', strong_sell: '#b71c1c',
};

function LongTermPage() {
  const { isAdmin } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allSymbols, setAllSymbols] = useState([]);
  const [selectedStocks, setSelectedStocks] = useState([]);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: null, ascending: true });
  const [checkedSymbols, setCheckedSymbols] = useState(new Set());
  const [deleting, setDeleting] = useState(false);
  const rowsPerPage = 15;

  const loadSymbols = useCallback(() => {
    apiGet('/watchlist/available-symbols')
      .then(res => setAllSymbols(res?.data ?? []))
      .catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    fetchWatchlist('long_term', { includeAll: isAdmin })
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isAdmin]);

  useEffect(() => {
    load(); loadSymbols();
    const iv = setInterval(load, 60000);
    return () => clearInterval(iv);
  }, [load, loadSymbols]);

  const existingSymbols = useMemo(() => new Set(data.map(d => d.symbol)), [data]);

  const availableSymbols = useMemo(() =>
    allSymbols.filter(s => !existingSymbols.has(s.symbol)),
    [allSymbols, existingSymbols]
  );

  const handleAddSelected = async () => {
    if (selectedStocks.length === 0) return;
    setAdding(true);
    try {
      for (const sym of selectedStocks) {
        const symbol = typeof sym === 'string' ? sym : sym.symbol;
        await addToWatchlist(symbol.toUpperCase(), 'long_term', '');
      }
      setSelectedStocks([]);
      load();
    } catch (e) { alert(e?.message || 'Failed to add'); }
    setAdding(false);
  };

  const handleRemoveFromList = (sym) => {
    setSelectedStocks(prev => prev.filter(s => (typeof s === 'string' ? s : s.symbol) !== (typeof sym === 'string' ? sym : sym.symbol)));
  };

  const toggleCheck = (sym) => {
    setCheckedSymbols(prev => {
      const next = new Set(prev);
      if (next.has(sym)) next.delete(sym); else next.add(sym);
      return next;
    });
  };

  const toggleSelectAllPage = () => {
    const pageSyms = paged.map(r => r.symbol);
    const allSelected = pageSyms.every(s => checkedSymbols.has(s));
    setCheckedSymbols(prev => {
      const next = new Set(prev);
      if (allSelected) pageSyms.forEach(s => next.delete(s));
      else pageSyms.forEach(s => next.add(s));
      return next;
    });
  };

  const selectAll = () => {
    setCheckedSymbols(new Set(sorted.map(r => r.symbol)));
  };

  const clearSelection = () => setCheckedSymbols(new Set());

  const handleBulkDelete = async () => {
    const syms = [...checkedSymbols];
    if (!syms.length) return;
    if (!window.confirm(`Delete ${syms.length} stock(s) from Long Term?\n\n${syms.join(', ')}`)) return;
    setDeleting(true);
    try {
      await bulkDeleteFromWatchlist(syms, 'long_term', { includeAll: isAdmin });
      setCheckedSymbols(new Set());
      load();
    } catch (e) { alert(e?.message || 'Bulk delete failed'); }
    setDeleting(false);
  };

  const filtered = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter(r =>
      (r.symbol || '').toLowerCase().includes(q) ||
      (r.sector || '').toLowerCase().includes(q)
    );
  }, [data, search]);

  const sorted = useMemo(() => {
    if (!sortConfig.key) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sortConfig.key] ?? '';
      const bv = b[sortConfig.key] ?? '';
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return sortConfig.ascending ? cmp : -cmp;
    });
  }, [filtered, sortConfig]);

  const totalPages = Math.ceil(sorted.length / rowsPerPage);
  const paged = sorted.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      ascending: prev.key === key ? !prev.ascending : true,
    }));
  };

  const columns = [
    { key: 'symbol', label: 'Symbol' },
    { key: 'price', label: 'CMP' },
    { key: 'day1d', label: '1D %' },
    { key: 'composite_score', label: 'Score' },
    { key: 'recommendation', label: 'Rating' },
    { key: 'trend', label: 'Trend' },
    { key: 'entry_price', label: 'Entry' },
    { key: 'stop_loss', label: 'SL' },
    { key: 'target_long_term', label: 'Target' },
    { key: 'risk_reward_ratio', label: 'R:R' },
  ];

  return (
    <TableSection>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
        <TableTitle style={{ margin: 0 }}>Long Term Watchlist</TableTitle>
        <Chip label="Auto-refresh 60s" size="small" variant="outlined" sx={{ fontSize: 11 }} />
        <IconButton size="small" onClick={load} title="Refresh now"><MdRefresh /></IconButton>
      </Box>

      <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <Autocomplete
          multiple
          size="small"
          options={availableSymbols}
          getOptionLabel={opt => typeof opt === 'string' ? opt : `${opt.symbol} — ${opt.sector || 'N/A'}`}
          isOptionEqualToValue={(opt, val) => (opt.symbol || opt) === (val.symbol || val)}
          filterOptions={(opts, { inputValue }) => {
            const q = inputValue.toLowerCase();
            return opts.filter(o =>
              o.symbol.toLowerCase().includes(q) ||
              (o.sector || '').toLowerCase().includes(q) ||
              (o.subsector || '').toLowerCase().includes(q)
            ).slice(0, 50);
          }}
          value={selectedStocks}
          onChange={(_, newVal) => setSelectedStocks(newVal)}
          renderInput={(params) => (
            <TextField {...params} placeholder="Search & select stocks…" />
          )}
          renderTags={() => null}
          sx={{ minWidth: 320, flex: 1 }}
          autoHighlight
          disableCloseOnSelect
        />
        <Button variant="contained" size="small" onClick={handleAddSelected}
          disabled={selectedStocks.length === 0 || adding}
          sx={{ bgcolor: '#1a3c5e', textTransform: 'none', height: 40, minWidth: 100 }}>
          {adding ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : `Add ${selectedStocks.length > 0 ? `(${selectedStocks.length})` : ''}`}
        </Button>
        <Box sx={{ flex: 1 }} />
        <TextField size="small" placeholder="Filter watchlist…" value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }} sx={{ width: 180 }} />
      </Box>

      {selectedStocks.length > 0 && (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2 }}>
          {selectedStocks.map(s => {
            const sym = typeof s === 'string' ? s : s.symbol;
            return (
              <Chip key={sym} label={sym} size="small"
                onDelete={() => handleRemoveFromList(s)}
                deleteIcon={<MdClose size={14} />}
                sx={{ fontWeight: 600, fontSize: 12 }} />
            );
          })}
        </Box>
      )}

      {checkedSymbols.size > 0 && (
        <Box sx={{ display: 'flex', gap: 1, mb: 1.5, alignItems: 'center', p: '6px 12px',
          bgcolor: '#e3f2fd', borderRadius: 1, border: '1px solid #90caf9' }}>
          <Chip label={`${checkedSymbols.size} selected`} size="small"
            sx={{ fontWeight: 700, fontSize: 12, bgcolor: '#1a3c5e', color: '#fff' }} />
          <Button size="small" startIcon={<MdSelectAll />} onClick={selectAll}
            sx={{ textTransform: 'none', fontSize: 11, color: '#1a3c5e' }}>
            Select All ({sorted.length})
          </Button>
          <Button size="small" onClick={clearSelection}
            sx={{ textTransform: 'none', fontSize: 11, color: '#666' }}>
            Clear
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button size="small" variant="contained" color="error" startIcon={<MdDeleteSweep />}
            onClick={handleBulkDelete} disabled={deleting}
            sx={{ textTransform: 'none', fontSize: 11 }}>
            {deleting ? 'Deleting…' : `Delete (${checkedSymbols.size})`}
          </Button>
        </Box>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
      ) : (
        <TableWrapper>
          <Table>
            <thead>
              <tr>
                <th style={{ width: 36, padding: '4px' }}>
                  <Checkbox size="small" sx={{ p: 0, color: '#fff', '&.Mui-checked': { color: '#fff' } }}
                    checked={paged.length > 0 && paged.every(r => checkedSymbols.has(r.symbol))}
                    indeterminate={paged.some(r => checkedSymbols.has(r.symbol)) && !paged.every(r => checkedSymbols.has(r.symbol))}
                    onChange={toggleSelectAllPage} />
                </th>
                {columns.map(c => (
                  <th key={c.key} onClick={() => handleSort(c.key)} style={{ cursor: 'pointer' }}>
                    {c.label} {sortConfig.key === c.key ? (sortConfig.ascending ? '▲' : '▼') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map(row => (
                <tr key={row.symbol} style={{ background: checkedSymbols.has(row.symbol) ? '#e3f2fd' : undefined }}>
                  <td style={{ padding: '4px', textAlign: 'center' }}>
                    <Checkbox size="small" sx={{ p: 0 }}
                      checked={checkedSymbols.has(row.symbol)}
                      onChange={() => toggleCheck(row.symbol)} />
                  </td>
                  <td style={{ fontWeight: 600 }}>{row.symbol}</td>
                  <td>{row.price ? `₹${Number(row.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}</td>
                  <td style={{ fontWeight: 600, color: (row.day1d || 0) > 0 ? '#2e7d32' : (row.day1d || 0) < 0 ? '#c62828' : undefined }}>
                    {row.day1d != null ? `${row.day1d > 0 ? '+' : ''}${row.day1d.toFixed(2)}%` : '—'}
                  </td>
                  <td style={{ fontWeight: 600 }}>{row.composite_score != null ? row.composite_score.toFixed(0) : '—'}</td>
                  <td>
                    {row.recommendation ? (
                      <Chip label={row.recommendation.replace('_', ' ').toUpperCase()} size="small"
                        sx={{ bgcolor: recColors[row.recommendation] || '#666', color: '#fff', fontWeight: 600, fontSize: 11 }} />
                    ) : '—'}
                  </td>
                  <td>{row.trend || '—'}</td>
                  <td>{row.entry_price ? `₹${row.entry_price.toFixed(2)}` : '—'}</td>
                  <td>{row.stop_loss ? `₹${row.stop_loss.toFixed(2)}` : '—'}</td>
                  <td>{row.target_long_term ? `₹${row.target_long_term.toFixed(2)}` : '—'}</td>
                  <td>{row.risk_reward_ratio ? `${row.risk_reward_ratio}:1` : '—'}</td>
                </tr>
              ))}
              {paged.length === 0 && (
                <tr><td colSpan={columns.length + 1} style={{ textAlign: 'center', padding: 24, color: '#888' }}>
                  No stocks in Long Term watchlist. Search and select stocks above to add.
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

export default LongTermPage;
