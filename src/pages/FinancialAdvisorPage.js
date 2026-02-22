import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { TableSection, TableTitle, TableWrapper, Table } from './SectorOutlook.styles';
import { Box, TextField, Button, Chip, CircularProgress, Tabs, Tab, Select, MenuItem, Autocomplete, IconButton, Tooltip } from '@mui/material';
import Pagination from '@mui/material/Pagination';
import { MdPlaylistAdd, MdCheck } from 'react-icons/md';
import { fetchRatings, fetchLatestSignals, fetchAlerts, markAlertRead, triggerAnalysis, fetchAnalysis, fetchPortfolioHealth, compareStocks, refreshAdvisor } from '../api/advisor';
import { addToWatchlist } from '../api/watchlist';
import { apiGet } from '../api/apiClient';

const trendColors = { bullish: '#1b5e20', bearish: '#c62828', sideways: '#f57f17' };
const fmt = (v) => {
  if (v == null || v === '' || isNaN(v)) return '—';
  return `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const compact = { fontSize: 12, padding: '4px 6px', whiteSpace: 'nowrap' };

function useSymbolList() {
  const [allSymbols, setAllSymbols] = useState([]);
  const load = useCallback(() => {
    apiGet('/watchlist/available-symbols')
      .then(res => setAllSymbols(res?.data ?? []))
      .catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);
  return allSymbols;
}

function WatchlistButtons({ symbol, added, onAdd }) {
  return (
    <Box sx={{ display: 'flex', gap: 0.3 }}>
      {['short_term', 'long_term'].map(lt => {
        const key = `${symbol}_${lt}`;
        const done = added[key];
        const isST = lt === 'short_term';
        return (
          <Tooltip key={lt} title={done ? 'Added' : (isST ? 'Short Term' : 'Long Term')}>
            <span>
              <IconButton size="small" disabled={!!done}
                onClick={() => onAdd(symbol, lt)}
                sx={{ p: '2px', bgcolor: done ? '#e8f5e9' : (isST ? '#e3f2fd' : '#fff3e0'),
                  color: done ? '#2e7d32' : (isST ? '#1565c0' : '#e65100'), fontSize: 13 }}>
                {done ? <MdCheck /> : <MdPlaylistAdd />}
              </IconButton>
            </span>
          </Tooltip>
        );
      })}
    </Box>
  );
}

function trendLabel(trend, recommendation) {
  const t = (trend || 'sideways').charAt(0).toUpperCase() + (trend || 'sideways').slice(1);
  const r = (recommendation || '').replace(/_/g, ' ');
  const short = r ? r.charAt(0).toUpperCase() + r.slice(1) : '';
  return short ? `${t} (${short})` : t;
}

function FinancialAdvisorPage() {
  const [tab, setTab] = useState(0);

  return (
    <TableSection>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <TableTitle style={{ margin: 0 }}>Financial Advisor</TableTitle>
        <Button size="small" variant="outlined" onClick={() => refreshAdvisor()} sx={{ textTransform: 'none', ml: 'auto' }}>
          Refresh All
        </Button>
      </Box>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto"
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tab label="Ratings" />
        <Tab label="Signals & Alerts" />
        <Tab label="AI Analysis" />
        <Tab label="Portfolio Health" />
      </Tabs>
      {tab === 0 && <RatingsTab />}
      {tab === 1 && <SignalsAlertsTab />}
      {tab === 2 && <AnalysisTab />}
      {tab === 3 && <PortfolioTab />}
    </TableSection>
  );
}

function RatingsTab() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [page, setPage] = useState(1);
  const rowsPerPage = 20;
  const allSymbols = useSymbolList();

  useEffect(() => {
    setLoading(true);
    fetchRatings(filter ? { recommendation: filter } : {}).then(setData).finally(() => setLoading(false));
  }, [filter]);

  const filtered = useMemo(() => {
    if (!selectedSymbol) return data;
    const sym = (typeof selectedSymbol === 'string' ? selectedSymbol : selectedSymbol.symbol).toLowerCase();
    return data.filter(r => r.symbol.toLowerCase().includes(sym));
  }, [data, selectedSymbol]);

  const totalPages = Math.ceil(filtered.length / rowsPerPage);
  const paged = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  return loading ? <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress /></Box> : (
    <>
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Select size="small" value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }} displayEmpty sx={{ width: 140 }}>
          <MenuItem value="">All Ratings</MenuItem>
          <MenuItem value="strong_buy">Strong Buy</MenuItem>
          <MenuItem value="buy">Buy</MenuItem>
          <MenuItem value="hold">Hold</MenuItem>
          <MenuItem value="sell">Sell</MenuItem>
          <MenuItem value="strong_sell">Strong Sell</MenuItem>
        </Select>
        <Autocomplete
          size="small"
          options={allSymbols}
          getOptionLabel={opt => typeof opt === 'string' ? opt : `${opt.symbol} — ${opt.sector || ''}`}
          isOptionEqualToValue={(opt, val) => (opt.symbol || opt) === (val.symbol || val)}
          filterOptions={(opts, { inputValue }) => {
            const q = inputValue.toLowerCase();
            return opts.filter(o =>
              o.symbol.toLowerCase().includes(q) ||
              (o.sector || '').toLowerCase().includes(q)
            ).slice(0, 40);
          }}
          value={selectedSymbol}
          onChange={(_, val) => { setSelectedSymbol(val); setPage(1); }}
          renderInput={(params) => <TextField {...params} placeholder="Filter symbol…" />}
          sx={{ width: 220 }}
          autoHighlight
        />
      </Box>
      <TableWrapper>
        <Table style={{ fontSize: 13 }}>
          <thead>
            <tr>
              <th style={compact}>Symbol</th>
              <th style={compact}>Score</th>
              <th style={compact}>Trend</th>
              <th style={compact}>Entry</th>
              <th style={compact}>SL</th>
              <th style={compact}>Target ST</th>
              <th style={compact}>Target LT</th>
              <th style={compact}>R:R</th>
            </tr>
          </thead>
          <tbody>
            {paged.map(r => {
              const isSell = ['sell', 'strong_sell'].includes(r.recommendation);
              const tColor = trendColors[r.trend] || '#666';
              const tgtColor = isSell ? '#c62828' : '#1b5e20';
              const slColor = isSell ? '#1b5e20' : '#c62828';
              return (
              <tr key={r.symbol}>
                <td style={{ ...compact, fontWeight: 600 }}>{r.symbol}</td>
                <td style={{ ...compact, fontWeight: 700 }}>{r.composite_score?.toFixed(0)}</td>
                <td style={{ ...compact, color: tColor, fontWeight: 600 }}>
                  {trendLabel(r.trend, r.recommendation)}
                </td>
                <td style={compact}>{r.entry_price ? fmt(r.entry_price) : '—'}</td>
                <td style={{ ...compact, color: slColor }}>{r.stop_loss ? fmt(r.stop_loss) : '—'}</td>
                <td style={{ ...compact, color: tgtColor }}>{r.target_short_term ? fmt(r.target_short_term) : '—'}</td>
                <td style={{ ...compact, color: tgtColor }}>{r.target_long_term ? fmt(r.target_long_term) : '—'}</td>
                <td style={compact}>{r.risk_reward_ratio ? `${r.risk_reward_ratio}:1` : '—'}</td>
              </tr>
              );
            })}
            {paged.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 24, color: '#888' }}>No ratings available. Run advisor refresh first.</td></tr>}
          </tbody>
        </Table>
      </TableWrapper>
      {totalPages > 1 && <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}><Pagination count={totalPages} page={page} onChange={(_, v) => setPage(v)} color="primary" /></Box>}
    </>
  );
}


function SignalsAlertsTab() {
  const [view, setView] = useState('signals');
  const [signalData, setSignalData] = useState([]);
  const [alertData, setAlertData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState('');
  const [symbolFilter, setSymbolFilter] = useState('');
  const [page, setPage] = useState(1);
  const [added, setAdded] = useState({});
  const rowsPerPage = 25;

  useEffect(() => {
    setLoading(true);
    const p1 = fetchLatestSignals(200).then(setSignalData).catch(() => {});
    const p2 = fetchAlerts({ limit: 200, ...(sourceFilter ? { source: sourceFilter } : {}), ...(symbolFilter ? { symbol: symbolFilter } : {}) }).then(setAlertData).catch(() => {});
    Promise.all([p1, p2]).finally(() => setLoading(false));
  }, [sourceFilter, symbolFilter]);

  const filteredSignals = useMemo(() => {
    let rows = signalData.filter(s => {
      if (!s.entry_price || !s.ema5) return true;
      const gap = Math.abs(s.ema5 - s.entry_price) / s.ema5;
      return gap <= 0.10;
    });
    if (symbolFilter) {
      const q = symbolFilter.toUpperCase();
      rows = rows.filter(s => s.symbol?.includes(q));
    }
    return rows;
  }, [signalData, symbolFilter]);

  const activeData = view === 'signals' ? filteredSignals : alertData;
  const totalPages = Math.ceil(activeData.length / rowsPerPage);
  const paged = activeData.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  const handleAdd = async (symbol, listType) => {
    const key = `${symbol}_${listType}`;
    if (added[key]) return;
    try {
      await addToWatchlist(symbol.toUpperCase(), listType, '');
      setAdded(prev => ({ ...prev, [key]: true }));
    } catch (_) { /* ignore */ }
  };

  const handleMarkRead = async (id) => {
    await markAlertRead(id);
    const f = { limit: 200 };
    if (sourceFilter) f.source = sourceFilter;
    if (symbolFilter) f.symbol = symbolFilter;
    fetchAlerts(f).then(setAlertData);
  };

  return (
    <>
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', border: '1px solid #ccc', borderRadius: 1, overflow: 'hidden' }}>
          {['signals', 'alerts'].map(v => (
            <Button key={v} size="small" onClick={() => { setView(v); setPage(1); }}
              sx={{ textTransform: 'none', px: 2, borderRadius: 0, fontSize: 12, fontWeight: view === v ? 700 : 400,
                bgcolor: view === v ? '#1a3c5e' : 'transparent', color: view === v ? '#fff' : '#333',
                '&:hover': { bgcolor: view === v ? '#1a3c5e' : '#f5f5f5' } }}>
              {v === 'signals' ? `Signals (${filteredSignals.length})` : `Alerts (${alertData.length})`}
            </Button>
          ))}
        </Box>
        {view === 'alerts' && (
          <Select size="small" value={sourceFilter} onChange={e => { setSourceFilter(e.target.value); setPage(1); }} displayEmpty sx={{ width: 120 }}>
            <MenuItem value="">All Sources</MenuItem>
            <MenuItem value="intraday">Intraday</MenuItem>
            <MenuItem value="eod">EOD</MenuItem>
            <MenuItem value="ai">AI</MenuItem>
            <MenuItem value="youtube_strategy">Strategy</MenuItem>
          </Select>
        )}
        <TextField size="small" placeholder="Symbol…" value={symbolFilter}
          onChange={e => { setSymbolFilter(e.target.value); setPage(1); }} sx={{ width: 110 }} />
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
      ) : view === 'signals' ? (
        <TableWrapper>
          <Table style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th style={compact}>Symbol</th><th style={compact}>Score</th><th style={compact}>Trend</th><th style={compact}>RSI</th><th style={compact}>ST</th>
                <th style={compact}>CMP</th><th style={compact}>Entry</th><th style={compact}>SL</th><th style={compact}>T1</th><th style={compact}>T2</th><th style={compact}>+</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((s, i) => {
                const cmp = s.ema5;
                const entryGap = cmp && s.entry_price ? ((s.entry_price - cmp) / cmp * 100).toFixed(1) : null;
                const gapColor = entryGap && Math.abs(entryGap) <= 3 ? '#2e7d32' : entryGap && Math.abs(entryGap) <= 7 ? '#f57f17' : '#888';
                const tColor = trendColors[s.trend] || '#666';
                return (
                <tr key={`sig-${s.symbol}-${i}`}>
                  <td style={{ ...compact, fontWeight: 600 }}>{s.symbol}</td>
                  <td style={{ ...compact, fontWeight: 700 }}>{s.signal_score?.toFixed(0)}</td>
                  <td style={{ ...compact, color: tColor, fontWeight: 600 }}>{trendLabel(s.trend, s.signal_type)}</td>
                  <td style={compact}>{s.rsi?.toFixed(1)}</td>
                  <td style={{ ...compact, color: s.supertrend_direction === 'up' ? '#2e7d32' : s.supertrend_direction === 'down' ? '#c62828' : undefined, fontWeight: 600 }}>
                    {s.supertrend_direction?.toUpperCase() || '—'}</td>
                  <td style={compact}>
                    {cmp ? `₹${cmp.toFixed(0)}` : '—'}
                    {entryGap && <span style={{ fontSize: 10, color: gapColor, marginLeft: 2 }}>({entryGap > 0 ? '+' : ''}{entryGap}%)</span>}
                  </td>
                  <td style={{ ...compact, fontWeight: 600, color: '#1565c0' }}>{fmt(s.entry_price)}</td>
                  <td style={{ ...compact, fontWeight: 600, color: '#c62828' }}>{fmt(s.stop_loss)}</td>
                  <td style={{ ...compact, fontWeight: 600, color: '#2e7d32' }}>{fmt(s.target_1)}</td>
                  <td style={compact}>{fmt(s.target_2)}</td>
                  <td style={compact}><WatchlistButtons symbol={s.symbol} added={added} onAdd={handleAdd} /></td>
                </tr>
                );
              })}
              {paged.length === 0 && <tr><td colSpan={11} style={{ textAlign: 'center', padding: 24, color: '#888' }}>No actionable signals for today.</td></tr>}
            </tbody>
          </Table>
        </TableWrapper>
      ) : (
        <TableWrapper>
          <Table style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th style={compact}>Time</th><th style={compact}>Symbol</th><th style={compact}>Entry</th><th style={compact}>SL</th>
                <th style={compact}>T1</th><th style={compact}>T2</th><th style={compact}>Score</th><th style={compact}>+</th><th style={compact}></th>
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
                  <td style={compact}><WatchlistButtons symbol={a.symbol} added={added} onAdd={handleAdd} /></td>
                  <td style={compact}>
                    {!a.is_read && (
                      <Button size="small" onClick={() => handleMarkRead(a.id)}
                        sx={{ textTransform: 'none', fontSize: 10, minWidth: 36, p: '1px 4px' }}>Read</Button>
                    )}
                  </td>
                </tr>
              ))}
              {paged.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 24, color: '#888' }}>No alerts matching filters.</td></tr>
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
    </>
  );
}


function AnalysisResultCard({ data, title }) {
  if (!data) return null;
  const d = typeof data === 'string' ? (() => { try { return JSON.parse(data); } catch { return null; } })() : data;
  if (!d) return <Box sx={{ bgcolor: '#f8f9fa', p: 2, borderRadius: 2, mb: 2, fontSize: 13 }}>{data}</Box>;

  const renderVal = (v) => {
    if (v === null || v === undefined) return '—';
    if (Array.isArray(v)) return v.map((item, i) => <li key={i} style={{ marginBottom: 2 }}>{typeof item === 'object' ? JSON.stringify(item) : String(item)}</li>);
    if (typeof v === 'object') return <pre style={{ margin: 0, fontSize: 12 }}>{JSON.stringify(v, null, 2)}</pre>;
    return String(v);
  };
  const labelStyle = { fontWeight: 600, color: '#1a3c5e', textTransform: 'capitalize', verticalAlign: 'top', padding: '4px 10px 4px 0', whiteSpace: 'nowrap', fontSize: 12 };
  const valStyle = { padding: '4px 0', lineHeight: 1.4, fontSize: 12 };

  const ratingColor = { strong_buy: '#1b5e20', buy: '#2e7d32', hold: '#f57f17', sell: '#c62828', strong_sell: '#b71c1c' };
  const rating = d.rating || d.recommendation;
  const confidence = d.confidence;

  return (
    <Box sx={{ bgcolor: '#f8f9fa', p: 2, borderRadius: 2, mb: 2, maxHeight: 450, overflow: 'auto' }}>
      {title && <Box sx={{ fontWeight: 700, fontSize: 14, mb: 1, color: '#1a3c5e' }}>{title}</Box>}
      {(rating || confidence != null) && (
        <Box sx={{ display: 'flex', gap: 2, mb: 1, alignItems: 'center' }}>
          {rating && <Chip label={String(rating).replace(/_/g, ' ').toUpperCase()} size="small"
            sx={{ bgcolor: ratingColor[rating] || '#666', color: '#fff', fontWeight: 700, fontSize: 11 }} />}
          {confidence != null && <span style={{ fontSize: 12, color: '#555' }}>Confidence: <strong>{confidence}%</strong></span>}
          {d.target_price && <span style={{ fontSize: 12, color: '#555' }}>Target: <strong>₹{d.target_price}</strong></span>}
          {d.horizon && <span style={{ fontSize: 12, color: '#555' }}>Horizon: <strong>{String(d.horizon).replace(/_/g, ' ')}</strong></span>}
        </Box>
      )}
      {d.summary && <Box sx={{ fontSize: 13, mb: 1, lineHeight: 1.5 }}>{d.summary}</Box>}
      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
        <tbody>
          {Object.entries(d).filter(([k]) => !['summary', 'rating', 'confidence', 'target_price', 'horizon'].includes(k)).map(([k, v]) => (
            <tr key={k} style={{ borderBottom: '1px solid #e0e0e0' }}>
              <td style={labelStyle}>{k.replace(/_/g, ' ')}</td>
              <td style={valStyle}>{Array.isArray(v) ? <ul style={{ margin: 0, paddingLeft: 16 }}>{renderVal(v)}</ul> : renderVal(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Box>
  );
}

function AnalysisTab() {
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [analysisType, setAnalysisType] = useState('earnings');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [compareSyms, setCompareSyms] = useState([]);
  const [compareResult, setCompareResult] = useState(null);
  const allSymbols = useSymbolList();

  const handleAnalyze = async () => {
    const sym = typeof selectedSymbol === 'string' ? selectedSymbol : selectedSymbol?.symbol;
    if (!sym) return;
    setLoading(true);
    try {
      const res = await triggerAnalysis(sym.toUpperCase(), analysisType);
      setResult(res?.result || res);
      const hist = await fetchAnalysis(sym.toUpperCase());
      setHistory(hist);
    } catch (e) {
      alert(e?.message || 'Analysis failed');
    }
    setLoading(false);
  };

  const handleCompare = async () => {
    const syms = compareSyms.map(s => typeof s === 'string' ? s : s.symbol).filter(Boolean);
    if (syms.length < 2) { alert('Select 2-3 symbols to compare'); return; }
    setLoading(true);
    try {
      const res = await compareStocks(syms);
      setCompareResult(res?.result || res);
    } catch (e) {
      alert(e?.message || 'Compare failed');
    }
    setLoading(false);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Autocomplete
          size="small"
          options={allSymbols}
          getOptionLabel={opt => typeof opt === 'string' ? opt : `${opt.symbol} — ${opt.sector || ''}`}
          isOptionEqualToValue={(opt, val) => (opt.symbol || opt) === (val.symbol || val)}
          filterOptions={(opts, { inputValue }) => {
            const q = inputValue.toLowerCase();
            return opts.filter(o =>
              o.symbol.toLowerCase().includes(q) ||
              (o.sector || '').toLowerCase().includes(q)
            ).slice(0, 40);
          }}
          value={selectedSymbol}
          onChange={(_, val) => setSelectedSymbol(val)}
          renderInput={(params) => <TextField {...params} placeholder="Select symbol…" />}
          sx={{ width: 220 }}
          autoHighlight
        />
        <Select size="small" value={analysisType} onChange={e => setAnalysisType(e.target.value)} sx={{ width: 170 }}>
          <MenuItem value="earnings">Earnings</MenuItem>
          <MenuItem value="deep_review">Deep Review</MenuItem>
          <MenuItem value="growth">Growth Fundamentals</MenuItem>
          <MenuItem value="equity_report">Equity Report</MenuItem>
          <MenuItem value="weekly_research">Weekly Research</MenuItem>
        </Select>
        <Button variant="contained" size="small" onClick={handleAnalyze} disabled={loading || !selectedSymbol}
          sx={{ bgcolor: '#1a3c5e', textTransform: 'none', fontSize: 12 }}>
          {loading ? 'Analysing…' : 'Analyse'}
        </Button>
        <Box sx={{ width: 16 }} />
        <Autocomplete
          multiple
          size="small"
          options={allSymbols}
          getOptionLabel={opt => typeof opt === 'string' ? opt : `${opt.symbol}`}
          isOptionEqualToValue={(opt, val) => (opt.symbol || opt) === (val.symbol || val)}
          filterOptions={(opts, { inputValue }) => {
            const q = inputValue.toLowerCase();
            return opts.filter(o => o.symbol.toLowerCase().includes(q)).slice(0, 30);
          }}
          value={compareSyms}
          onChange={(_, val) => setCompareSyms(val.slice(0, 3))}
          renderInput={(params) => <TextField {...params} placeholder="Compare 2-3…" />}
          sx={{ width: 240 }}
          autoHighlight
          disableCloseOnSelect
        />
        <Button variant="outlined" size="small" onClick={handleCompare} disabled={loading || compareSyms.length < 2}
          sx={{ textTransform: 'none', fontSize: 12 }}>Compare</Button>
      </Box>

      {loading && <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress /></Box>}
      {result && !loading && <AnalysisResultCard data={result} />}
      {compareResult && !loading && <AnalysisResultCard data={compareResult} title="Comparison Result" />}

      {history.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Box sx={{ fontWeight: 600, mb: 1, fontSize: 13 }}>Analysis History</Box>
          <TableWrapper>
            <Table style={{ fontSize: 12 }}>
              <thead>
                <tr><th style={compact}>Type</th><th style={compact}>Rating</th><th style={compact}>Confidence</th><th style={compact}>Target</th><th style={compact}>Horizon</th><th style={compact}>Provider</th><th style={compact}>Date</th></tr>
              </thead>
              <tbody>
                {history.map(h => (
                  <tr key={h.id}>
                    <td style={compact}>{h.analysis_type}</td>
                    <td style={compact}>{h.rating || '—'}</td>
                    <td style={compact}>{h.confidence != null ? `${h.confidence}%` : '—'}</td>
                    <td style={compact}>{h.target_price ? `₹${h.target_price}` : '—'}</td>
                    <td style={compact}>{h.horizon || '—'}</td>
                    <td style={compact}>{h.llm_provider}</td>
                    <td style={compact}>{h.created_at?.split('T')[0]}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrapper>
        </Box>
      )}
    </Box>
  );
}

function PortfolioTab() {
  const [selectedSymbols, setSelectedSymbols] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const allSymbols = useSymbolList();

  const handleCheck = async () => {
    const syms = selectedSymbols.map(s => typeof s === 'string' ? s : s.symbol).filter(Boolean);
    if (!syms.length) return;
    setLoading(true);
    try {
      const res = await fetchPortfolioHealth(syms);
      setResult(res);
    } catch (e) {
      alert(e?.message || 'Failed');
    }
    setLoading(false);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
        <Autocomplete
          multiple
          size="small"
          options={allSymbols}
          getOptionLabel={opt => typeof opt === 'string' ? opt : `${opt.symbol} — ${opt.sector || ''}`}
          isOptionEqualToValue={(opt, val) => (opt.symbol || opt) === (val.symbol || val)}
          filterOptions={(opts, { inputValue }) => {
            const q = inputValue.toLowerCase();
            return opts.filter(o =>
              o.symbol.toLowerCase().includes(q) ||
              (o.sector || '').toLowerCase().includes(q)
            ).slice(0, 40);
          }}
          value={selectedSymbols}
          onChange={(_, val) => setSelectedSymbols(val)}
          renderInput={(params) => <TextField {...params} placeholder="Select portfolio stocks…" />}
          sx={{ width: 400 }}
          autoHighlight
          disableCloseOnSelect
        />
        <Button variant="contained" size="small" onClick={handleCheck} disabled={loading || selectedSymbols.length === 0}
          sx={{ bgcolor: '#1a3c5e', textTransform: 'none', fontSize: 12 }}>
          {loading ? 'Checking…' : 'Check Health'}
        </Button>
      </Box>

      {loading && <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress /></Box>}

      {result && !loading && (
        <Box sx={{ bgcolor: '#f8f9fa', p: 2, borderRadius: 2, fontFamily: 'monospace', fontSize: 12, maxHeight: 500, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
          {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
        </Box>
      )}
    </Box>
  );
}

export default FinancialAdvisorPage;
