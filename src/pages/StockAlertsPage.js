import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { TableSection, TableTitle, TableWrapper, Table } from './SectorOutlook.styles';
import { Alert, Box, Button, CircularProgress, IconButton, MenuItem, Select, TextField } from '@mui/material';
import Pagination from '@mui/material/Pagination';
import { MdDelete } from 'react-icons/md';
import { FaSortUp, FaSortDown, FaSort } from 'react-icons/fa';
import { clearPriceAlertTriggers, deletePriceAlertTrigger, fetchPriceAlertTriggers } from '../api/priceAlerts';
import { backfillLevelDivergenceAlerts, fetchSpecialAlerts } from '../api/advisor';
import { useAuth } from '../auth/AuthContext';

const fmtRupee = (v) => {
  if (v == null || v === '' || isNaN(v)) return '—';
  return `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const compact = { fontSize: 12, padding: '4px 6px', whiteSpace: 'nowrap' };
const isMissingResourceError = (err) => {
  const msg = String(err?.message || '').toLowerCase();
  return msg.includes('not found') || msg.includes('404');
};

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
  const [advisorAlerts, setAdvisorAlerts] = useState([]);
  const [setupSideFilter, setSetupSideFilter] = useState('all');
  const [weeklyAlertTypeFilter, setWeeklyAlertTypeFilter] = useState('all');
  const [rsiAlertTypeFilter, setRsiAlertTypeFilter] = useState('all');
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
      .catch((e) => {
        if (isMissingResourceError(e)) {
          setData([]);
          setErrorMsg('');
          return;
        }
        setErrorMsg(e?.message || 'Failed to load alert history');
      })
      .finally(() => setLoading(false));

    fetchSpecialAlerts({ limit: 1200, symbol: symbolFilter })
      .then((rows) => setAdvisorAlerts(Array.isArray(rows) ? rows : []))
      .catch(() => setAdvisorAlerts([]));
  }, [userId, symbolFilter]);

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

  const handleGenerateFromOldData = async () => {
    try {
      setLoading(true);
      const res = await backfillLevelDivergenceAlerts({ days: 180, limitSymbols: 300 });
      const created = Number(res?.created || 0);
      setStatusMsg(created > 0 ? `Generated ${created} alerts from historical data.` : 'No new historical alerts were generated.');
      await load();
    } catch (e) {
      setErrorMsg(e?.message || 'Failed to generate alerts from historical data');
    } finally {
      setLoading(false);
    }
  };

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <FaSort style={{ opacity: 0.3, marginLeft: 2, fontSize: 10 }} />;
    return sortDir === 'asc'
      ? <FaSortUp style={{ color: '#1565c0', marginLeft: 2, fontSize: 10 }} />
      : <FaSortDown style={{ color: '#1565c0', marginLeft: 2, fontSize: 10 }} />;
  };

  const getAlertSide = (alertType) => {
    const t = String(alertType || '').toLowerCase();
    if (t.includes('cross_up') || t.includes('bullish') || t.endsWith('_bull') || t.includes('_buy')) return 'bullish';
    if (t.includes('cross_down') || t.includes('bearish') || t.endsWith('_bear') || t.includes('_sell')) return 'bearish';
    return 'unknown';
  };

  const weeklyCrossRows = useMemo(
    () => advisorAlerts
      .filter((a) => String(a.alert_type || '').toLowerCase().startsWith('weekly_cross_'))
      .filter((a) => setupSideFilter === 'all' || getAlertSide(a.alert_type) === setupSideFilter)
      .filter((a) => weeklyAlertTypeFilter === 'all' || String(a.alert_type || '').toLowerCase() === weeklyAlertTypeFilter)
      .slice(0, 100),
    [advisorAlerts, setupSideFilter, weeklyAlertTypeFilter]
  );

  const divergenceRows = useMemo(
    () => advisorAlerts
      .filter((a) => String(a.alert_type || '').toLowerCase().startsWith('rsi_divergence_'))
      .filter((a) => setupSideFilter === 'all' || getAlertSide(a.alert_type) === setupSideFilter)
      .filter((a) => rsiAlertTypeFilter === 'all' || String(a.alert_type || '').toLowerCase() === rsiAlertTypeFilter)
      .slice(0, 100),
    [advisorAlerts, setupSideFilter, rsiAlertTypeFilter]
  );

  return (
    <TableSection>
      <TableTitle>Stock Alerts</TableTitle>

      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Select size="small" value={listTypeFilter} onChange={e => { setListTypeFilter(e.target.value); setPage(1); }} displayEmpty sx={{ width: 140 }}>
          <MenuItem value="">All Lists</MenuItem>
          <MenuItem value="short_term">Short Term</MenuItem>
          <MenuItem value="long_term">Long Term</MenuItem>
        </Select>
        <Select
          size="small"
          value={setupSideFilter}
          onChange={(e) => setSetupSideFilter(e.target.value)}
          sx={{ width: 170 }}
        >
          <MenuItem value="all">All Setups</MenuItem>
          <MenuItem value="bullish">Bullish Setups</MenuItem>
          <MenuItem value="bearish">Bearish Setups</MenuItem>
        </Select>
        <TextField size="small" placeholder="Symbol…" value={symbolFilter}
          onChange={e => { setSymbolFilter(e.target.value); setPage(1); }} sx={{ width: 110 }} />
        <Box sx={{ flex: 1 }} />
        <Button size="small" variant="outlined" onClick={load} sx={{ textTransform: 'none', fontSize: 12 }}>
          Refresh
        </Button>
        <Button size="small" variant="outlined" onClick={handleGenerateFromOldData} sx={{ textTransform: 'none', fontSize: 12 }}>
          Generate From Old Data
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

      <Box sx={{ mt: 3 }}>
        <TableTitle>Weekly Level Cross Alerts (Backend)</TableTitle>
        <Box sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
          <Select
            size="small"
            value={weeklyAlertTypeFilter}
            onChange={(e) => setWeeklyAlertTypeFilter(e.target.value)}
            sx={{ width: 260 }}
          >
            <MenuItem value="all">All Weekly Alert Types</MenuItem>
            <MenuItem value="weekly_cross_up_low">weekly_cross_up_low</MenuItem>
            <MenuItem value="weekly_cross_up_mid">weekly_cross_up_mid</MenuItem>
            <MenuItem value="weekly_cross_up_high">weekly_cross_up_high</MenuItem>
            <MenuItem value="weekly_cross_down_low">weekly_cross_down_low</MenuItem>
            <MenuItem value="weekly_cross_down_mid">weekly_cross_down_mid</MenuItem>
            <MenuItem value="weekly_cross_down_high">weekly_cross_down_high</MenuItem>
          </Select>
        </Box>
        <TableWrapper>
          <Table style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th style={compact}>Time</th>
                <th style={compact}>Symbol</th>
                <th style={compact}>Alert</th>
                <th style={compact}>Severity</th>
                <th style={compact}>Message</th>
                <th style={compact}>Telegram</th>
              </tr>
            </thead>
            <tbody>
              {weeklyCrossRows.map((a) => (
                  <tr key={`advisor_${a.id}`}>
                    <td style={compact}>{a.timestamp?.replace('T', ' ').slice(0, 19) || '—'}</td>
                    <td style={{ ...compact, fontWeight: 600 }}>{a.symbol || '—'}</td>
                    <td style={{ ...compact, fontWeight: 600 }}>{a.alert_type || '—'}</td>
                    <td style={compact}>{a.severity || '—'}</td>
                    <td style={{ ...compact, maxWidth: 500, whiteSpace: 'normal' }}>{a.message || '—'}</td>
                    <td style={compact}>{a.is_sent_telegram ? 'Sent' : 'Pending'}</td>
                  </tr>
                ))}
              {weeklyCrossRows.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 16, color: '#888' }}>
                  No weekly level cross alerts yet.
                </td></tr>
              )}
            </tbody>
          </Table>
        </TableWrapper>
      </Box>

      <Box sx={{ mt: 3 }}>
        <TableTitle>Divergence Alerts (5m RSI)</TableTitle>
        <Box sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
          <Select
            size="small"
            value={rsiAlertTypeFilter}
            onChange={(e) => setRsiAlertTypeFilter(e.target.value)}
            sx={{ width: 260 }}
          >
            <MenuItem value="all">All RSI Alert Types</MenuItem>
            <MenuItem value="rsi_divergence_bullish_5m">rsi_divergence_bullish_5m</MenuItem>
            <MenuItem value="rsi_divergence_bearish_5m">rsi_divergence_bearish_5m</MenuItem>
          </Select>
        </Box>
        <TableWrapper>
          <Table style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th style={compact}>Time</th>
                <th style={compact}>Symbol</th>
                <th style={compact}>Type</th>
                <th style={compact}>Severity</th>
                <th style={compact}>Message</th>
                <th style={compact}>Telegram</th>
              </tr>
            </thead>
            <tbody>
              {divergenceRows.map((a) => (
                <tr key={`div_${a.id}`}>
                  <td style={compact}>{a.timestamp?.replace('T', ' ').slice(0, 19) || '—'}</td>
                  <td style={{ ...compact, fontWeight: 600 }}>{a.symbol || '—'}</td>
                  <td style={{ ...compact, fontWeight: 600 }}>{a.alert_type || '—'}</td>
                  <td style={compact}>{a.severity || '—'}</td>
                  <td style={{ ...compact, maxWidth: 500, whiteSpace: 'normal' }}>{a.message || '—'}</td>
                  <td style={compact}>{a.is_sent_telegram ? 'Sent' : 'Pending'}</td>
                </tr>
              ))}
              {divergenceRows.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 16, color: '#888' }}>
                  No RSI divergence alerts yet.
                </td></tr>
              )}
            </tbody>
          </Table>
        </TableWrapper>
      </Box>
    </TableSection>
  );
}

export default StockAlertsPage;
