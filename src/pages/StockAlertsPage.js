import React, { useState, useEffect } from 'react';
import { TableSection, TableTitle, TableWrapper, Table } from './SectorOutlook.styles';
import { Box, TextField, Button, CircularProgress, Select, MenuItem, IconButton, Tooltip } from '@mui/material';
import Pagination from '@mui/material/Pagination';
import { MdPlaylistAdd, MdCheck } from 'react-icons/md';
import { fetchAlerts, markAlertRead } from '../api/advisor';
import { addToWatchlist } from '../api/watchlist';

const fmt = (v) => {
  if (v == null || v === '' || isNaN(v)) return '—';
  return `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const compact = { fontSize: 12, padding: '4px 6px', whiteSpace: 'nowrap' };

function StockAlertsPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState('');
  const [symbolFilter, setSymbolFilter] = useState('');
  const [page, setPage] = useState(1);
  const [added, setAdded] = useState({});
  const rowsPerPage = 25;

  const load = () => {
    setLoading(true);
    const f = { limit: 200 };
    if (sourceFilter) f.source = sourceFilter;
    if (symbolFilter) f.symbol = symbolFilter;
    fetchAlerts(f).then(setData).finally(() => setLoading(false));
  };

  useEffect(load, [sourceFilter, symbolFilter]);

  const totalPages = Math.ceil(data.length / rowsPerPage);
  const paged = data.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  const handleMarkRead = async (id) => {
    await markAlertRead(id);
    load();
  };

  const handleMarkAllRead = async () => {
    const unread = data.filter(a => !a.is_read);
    for (const a of unread.slice(0, 50)) {
      await markAlertRead(a.id);
    }
    load();
  };

  const handleAdd = async (symbol, listType) => {
    const key = `${symbol}_${listType}`;
    if (added[key]) return;
    try {
      await addToWatchlist(symbol.toUpperCase(), listType, '');
      setAdded(prev => ({ ...prev, [key]: true }));
    } catch (_) { /* ignore */ }
  };

  return (
    <TableSection>
      <TableTitle>Stock Alerts</TableTitle>

      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Select size="small" value={sourceFilter} onChange={e => { setSourceFilter(e.target.value); setPage(1); }} displayEmpty sx={{ width: 130 }}>
          <MenuItem value="">All Sources</MenuItem>
          <MenuItem value="intraday">Intraday</MenuItem>
          <MenuItem value="eod">EOD</MenuItem>
          <MenuItem value="ai">AI</MenuItem>
          <MenuItem value="youtube_strategy">Strategy</MenuItem>
        </Select>
        <TextField size="small" placeholder="Symbol…" value={symbolFilter}
          onChange={e => { setSymbolFilter(e.target.value); setPage(1); }} sx={{ width: 110 }} />
        <Box sx={{ flex: 1 }} />
        <Button size="small" variant="outlined" onClick={handleMarkAllRead} sx={{ textTransform: 'none', fontSize: 12 }}>
          Mark All Read
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
      ) : (
        <TableWrapper>
          <Table style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th style={compact}>Time</th>
                <th style={compact}>Symbol</th>
                <th style={compact}>Entry</th>
                <th style={compact}>SL</th>
                <th style={compact}>T1</th>
                <th style={compact}>T2</th>
                <th style={compact}>Score</th>
                <th style={compact}>+</th>
                <th style={compact}></th>
              </tr>
            </thead>
            <tbody>
              {paged.map(a => (
                <tr key={a.id} style={{ opacity: a.is_read ? 0.55 : 1, background: !a.is_read ? '#fffde7' : undefined }}>
                  <td style={compact}>{a.timestamp?.replace('T', ' ').slice(0, 16) || '—'}</td>
                  <td style={{ ...compact, fontWeight: 600 }}>{a.symbol}</td>
                  <td style={{ ...compact, fontWeight: 600, color: '#1565c0' }}>{fmt(a.entry_price)}</td>
                  <td style={{ ...compact, fontWeight: 600, color: '#c62828' }}>{fmt(a.stop_loss)}</td>
                  <td style={{ ...compact, fontWeight: 600, color: '#2e7d32' }}>{fmt(a.target_1)}</td>
                  <td style={compact}>{fmt(a.target_2)}</td>
                  <td style={{ ...compact, textAlign: 'center' }}>{a.signal_score != null ? a.signal_score : '—'}</td>
                  <td style={compact}>
                    <Box sx={{ display: 'flex', gap: 0.3 }}>
                      <Tooltip title={added[`${a.symbol}_short_term`] ? 'Added' : 'Short Term'}>
                        <span>
                          <IconButton size="small" disabled={!!added[`${a.symbol}_short_term`]}
                            onClick={() => handleAdd(a.symbol, 'short_term')}
                            sx={{ p: '2px', bgcolor: added[`${a.symbol}_short_term`] ? '#e8f5e9' : '#e3f2fd', color: added[`${a.symbol}_short_term`] ? '#2e7d32' : '#1565c0', fontSize: 13 }}>
                            {added[`${a.symbol}_short_term`] ? <MdCheck /> : <MdPlaylistAdd />}
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title={added[`${a.symbol}_long_term`] ? 'Added' : 'Long Term'}>
                        <span>
                          <IconButton size="small" disabled={!!added[`${a.symbol}_long_term`]}
                            onClick={() => handleAdd(a.symbol, 'long_term')}
                            sx={{ p: '2px', bgcolor: added[`${a.symbol}_long_term`] ? '#e8f5e9' : '#fff3e0', color: added[`${a.symbol}_long_term`] ? '#2e7d32' : '#e65100', fontSize: 13 }}>
                            {added[`${a.symbol}_long_term`] ? <MdCheck /> : <MdPlaylistAdd />}
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Box>
                  </td>
                  <td style={compact}>
                    {!a.is_read && (
                      <Button size="small" onClick={() => handleMarkRead(a.id)}
                        sx={{ textTransform: 'none', fontSize: 10, minWidth: 36, p: '1px 4px' }}>Read</Button>
                    )}
                  </td>
                </tr>
              ))}
              {paged.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 24, color: '#888' }}>
                  No alerts matching filters.
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
