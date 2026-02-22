import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { TableSection, TableTitle, TableWrapper, Table } from './SectorOutlook.styles';
import { Box, TextField, Button, IconButton, Chip, CircularProgress, Autocomplete } from '@mui/material';
import Pagination from '@mui/material/Pagination';
import { MdDelete, MdSwapHoriz, MdRefresh, MdClose } from 'react-icons/md';
import { fetchWatchlist, addToWatchlist, removeFromWatchlist, updateWatchlistEntry, fetchWatchlistSignals } from '../api/watchlist';
import { apiGet } from '../api/apiClient';

const tierColors = {
  B1: '#66bb6a', B2: '#43a047', B3: '#1b5e20',
  S1: '#ef5350', S2: '#c62828', S3: '#b71c1c',
};

function ShortTermPage() {
  const [data, setData] = useState([]);
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allSymbols, setAllSymbols] = useState([]);
  const [selectedStocks, setSelectedStocks] = useState([]);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: null, ascending: true });
  const rowsPerPage = 15;

  const loadSymbols = useCallback(() => {
    apiGet('/watchlist/available-symbols')
      .then(res => setAllSymbols(res?.data ?? []))
      .catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetchWatchlist('short_term'),
      fetchWatchlistSignals(),
    ]).then(([wl, sigs]) => {
      setData(wl);
      setSignals(sigs);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    loadSymbols();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
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
        await addToWatchlist(symbol.toUpperCase(), 'short_term', '');
      }
      setSelectedStocks([]);
      load();
    } catch (e) { alert(e?.message || 'Failed to add'); }
    setAdding(false);
  };

  const handleRemoveFromList = (sym) => {
    setSelectedStocks(prev => prev.filter(s => (typeof s === 'string' ? s : s.symbol) !== (typeof sym === 'string' ? sym : sym.symbol)));
  };

  const handleRemove = async (sym) => {
    if (!window.confirm(`Remove ${sym}?`)) return;
    try {
      await removeFromWatchlist(sym, 'short_term');
    } catch (e) { console.warn('Remove failed:', e); }
    load();
  };

  const handleMoveToLong = async (sym) => {
    try {
      await updateWatchlistEntry(sym, { list_type: 'long_term' });
    } catch (e) { console.warn('Move failed:', e); }
    load();
  };

  const sigMap = useMemo(() => {
    const m = {};
    signals.forEach(s => { m[s.symbol] = s; });
    return m;
  }, [signals]);

  const merged = useMemo(() => {
    return data.map(d => ({ ...d, ...(sigMap[d.symbol] || {}) }));
  }, [data, sigMap]);

  const filtered = useMemo(() => {
    if (!search) return merged;
    const q = search.toLowerCase();
    return merged.filter(r =>
      (r.symbol || '').toLowerCase().includes(q) ||
      (r.sector || '').toLowerCase().includes(q)
    );
  }, [merged, search]);

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
    { key: 'sector', label: 'Sector' },
    { key: 'price', label: 'CMP' },
    { key: 'day1d', label: '1D %' },
    { key: 'market_cap', label: 'Mkt Cap' },
    { key: 'buy_sell_tier', label: 'Signal Tier' },
    { key: 'supertrend_direction', label: 'SuperTrend' },
    { key: 'rsi', label: 'RSI' },
    { key: 'macd_cross', label: 'MACD' },
    { key: 'volume_ratio', label: 'Vol Ratio' },
    { key: 'signal_score', label: 'Score' },
    { key: 'entry_price', label: 'Entry' },
    { key: 'stop_loss', label: 'SL' },
    { key: 'target_short_term', label: 'Target' },
  ];

  return (
    <TableSection>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
        <TableTitle style={{ margin: 0 }}>Short Term Watchlist</TableTitle>
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

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
      ) : (
        <TableWrapper>
          <Table>
            <thead>
              <tr>
                {columns.map(c => (
                  <th key={c.key} onClick={() => handleSort(c.key)} style={{ cursor: 'pointer' }}>
                    {c.label} {sortConfig.key === c.key ? (sortConfig.ascending ? '▲' : '▼') : ''}
                  </th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.map(row => (
                <tr key={row.symbol}>
                  <td style={{ fontWeight: 600 }}>{row.symbol}</td>
                  <td style={{ fontSize: 12 }}>{row.sector || '—'}</td>
                  <td>{row.price ? `₹${Number(row.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}</td>
                  <td style={{ fontWeight: 600, color: (row.day1d || 0) > 0 ? '#2e7d32' : (row.day1d || 0) < 0 ? '#c62828' : undefined }}>
                    {row.day1d != null ? `${row.day1d > 0 ? '+' : ''}${row.day1d.toFixed(2)}%` : '—'}
                  </td>
                  <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{row.market_cap || '—'}</td>
                  <td>
                    {row.buy_sell_tier ? (
                      <Chip label={row.buy_sell_tier} size="small"
                        sx={{ bgcolor: tierColors[row.buy_sell_tier] || '#666', color: '#fff', fontWeight: 700, fontSize: 12 }} />
                    ) : '—'}
                  </td>
                  <td style={{ color: row.supertrend_direction === 'up' ? '#2e7d32' : row.supertrend_direction === 'down' ? '#c62828' : undefined, fontWeight: 600 }}>
                    {row.supertrend_direction ? row.supertrend_direction.toUpperCase() : '—'}
                  </td>
                  <td style={{ color: (row.rsi || 0) > 60 ? '#2e7d32' : (row.rsi || 0) < 40 ? '#c62828' : undefined }}>
                    {row.rsi != null ? row.rsi.toFixed(1) : '—'}
                  </td>
                  <td style={{ color: row.macd_cross === 'buy' ? '#2e7d32' : row.macd_cross === 'sell' ? '#c62828' : undefined, fontWeight: 600 }}>
                    {row.macd_cross ? row.macd_cross.toUpperCase() : '—'}
                  </td>
                  <td style={{ fontWeight: 600, color: (row.volume_ratio || 0) >= 2 ? '#c62828' : undefined }}>
                    {row.volume_ratio != null ? `${row.volume_ratio.toFixed(1)}x` : '—'}
                  </td>
                  <td style={{ fontWeight: 600 }}>{row.signal_score != null ? row.signal_score.toFixed(0) : '—'}</td>
                  <td>{row.entry_price ? `₹${row.entry_price.toFixed(2)}` : '—'}</td>
                  <td>{row.stop_loss ? `₹${row.stop_loss.toFixed(2)}` : '—'}</td>
                  <td>{row.target_short_term ? `₹${row.target_short_term.toFixed(2)}` : (row.target_1 ? `₹${row.target_1.toFixed(2)}` : '—')}</td>
                  <td>
                    <IconButton size="small" title="Move to Long Term" onClick={() => handleMoveToLong(row.symbol)}>
                      <MdSwapHoriz />
                    </IconButton>
                    <IconButton size="small" title="Remove" color="error" onClick={() => handleRemove(row.symbol)}>
                      <MdDelete />
                    </IconButton>
                  </td>
                </tr>
              ))}
              {paged.length === 0 && (
                <tr><td colSpan={columns.length + 1} style={{ textAlign: 'center', padding: 24, color: '#888' }}>
                  No stocks in Short Term watchlist. Search and select stocks above to add.
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

export default ShortTermPage;
