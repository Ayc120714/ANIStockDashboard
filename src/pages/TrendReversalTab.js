import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  MenuItem,
  TextField,
  Typography,
  Select,
  FormControl,
  InputLabel,
  Snackbar,
} from '@mui/material';
import { MdArrowDownward, MdArrowUpward, MdBolt, MdRefresh } from 'react-icons/md';
import { TableSection, TableTitle } from './SectorOutlook.styles';
import { fetchBuyTierCardGrid } from '../api/advisor';
import TradingViewLink from '../components/TradingViewLink';

const TF_BLUE = '#1565c0';
const BORDER = '1px solid #e0e0e0';
const CARD_BG = '#fafafa';

const TIMES = [
  { tf: 'daily', label: 'Daily' },
  { tf: 'weekly', label: 'Weekly' },
  { tf: 'monthly', label: 'Monthly' },
];

const BUY_ROW = [
  { id: 'all', label: 'All' },
  { id: 'B1', label: 'B1' },
  { id: 'B2', label: 'B2' },
  { id: 'B3', label: 'B3' },
];

const SELL_ROW = [
  { id: 'S1', label: 'S1' },
  { id: 'S2', label: 'S2' },
  { id: 'S3', label: 'S3' },
];

const ALL_TIERS = ['B1', 'B2', 'B3', 'S1', 'S2', 'S3'];
const BUY_HINT = { B1: 'Early', B2: 'Stronger', B3: 'Strongest' };

/** Table column id → sort key (matches row fields). */
const TABLE_COLUMNS = [
  { key: 'symbol', label: 'SYMBOL' },
  { key: 'company', label: 'COMPANY' },
  { key: 'mcap', label: 'MCAP (CR)' },
  { key: 'sector', label: 'SECTOR' },
  { key: 'close', label: 'CLOSE' },
  { key: 'signal', label: 'SIGNAL' },
  { key: 'chg', label: 'CHG%' },
  { key: 'vol', label: 'VOL' },
  { key: 'date', label: 'DATE' },
];

const SIGNAL_SORT_ORDER = { B1: 1, B2: 2, B3: 3, S1: 4, S2: 5, S3: 6 };

function parseMcapSortValue(m) {
  if (m == null) return null;
  const match = String(m).replace(/,/g, '').match(/[\d.]+/);
  if (!match) return null;
  const n = parseFloat(match[0]);
  return Number.isNaN(n) ? null : n;
}

function sortComparable(row, sortKey) {
  switch (sortKey) {
    case 'symbol':
      return String(row.symbol || '').toUpperCase();
    case 'company':
      return String(row.company || '').toLowerCase();
    case 'mcap':
      return parseMcapSortValue(row.market_cap);
    case 'sector':
      return String(row.sector || '').toLowerCase();
    case 'close':
      return row.close != null && !Number.isNaN(Number(row.close)) ? Number(row.close) : null;
    case 'signal':
      return SIGNAL_SORT_ORDER[String(row.buy_sell_tier || '').toUpperCase()] ?? 99;
    case 'chg':
      return row.chg_pct != null && !Number.isNaN(Number(row.chg_pct)) ? Number(row.chg_pct) : null;
    case 'vol':
      return row.volume != null && !Number.isNaN(Number(row.volume)) ? Number(row.volume) : null;
    case 'date': {
      const t = row.date ? Date.parse(String(row.date)) : NaN;
      return Number.isNaN(t) ? null : t;
    }
    default:
      return '';
  }
}

function tierBlock(grid, tf, tier) {
  return grid?.[tf]?.[tier] || { count: 0, items: [] };
}

function formatVol(v) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return Number(v).toLocaleString('en-IN');
}

function formatChg(p) {
  if (p == null || Number.isNaN(Number(p))) return { text: '—', pos: null };
  const n = Number(p);
  const sign = n > 0 ? '+' : '';
  return { text: `${sign}${n.toFixed(2)}%`, pos: n > 0 ? true : n < 0 ? false : null };
}

function formatClose(x) {
  if (x == null || Number.isNaN(Number(x))) return '—';
  return `₹${Number(x).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatMcap(m) {
  if (!m || !String(m).trim()) return '—';
  const s = String(m).trim();
  return s.startsWith('₹') ? s : `₹${s}`;
}

export default function TrendReversalTab() {
  const [grid, setGrid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeframe, setTimeframe] = useState('weekly');
  const [tierSignal, setTierSignal] = useState('all');
  const [freshOnly, setFreshOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [sector, setSector] = useState('__all__');
  const [snack, setSnack] = useState({ open: false, message: '' });
  const [sortKey, setSortKey] = useState('symbol');
  const [sortDir, setSortDir] = useState('asc');

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchBuyTierCardGrid({ refresh, symbol_limit: 800 });
      setGrid(payload?.data ?? null);
    } catch (e) {
      setError(e?.message || 'Failed to load');
      setGrid(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  const sectorOptions = useMemo(() => {
    if (!grid || !grid[timeframe]) return [];
    const set = new Set();
    ALL_TIERS.forEach((t) => {
      (tierBlock(grid, timeframe, t).items || []).forEach((r) => {
        if (r.sector && String(r.sector).trim()) set.add(String(r.sector).trim());
      });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [grid, timeframe]);

  const tableRows = useMemo(() => {
    if (!grid || !grid[timeframe]) return [];
    const tiers =
      tierSignal === 'all' ? ALL_TIERS : [tierSignal];
    let rows = tiers.flatMap((t) => tierBlock(grid, timeframe, t).items || []);
    if (freshOnly) rows = rows.filter((r) => r.is_fresh);
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (r) =>
          String(r.symbol || '')
            .toLowerCase()
            .includes(q) ||
          String(r.company || '')
            .toLowerCase()
            .includes(q),
      );
    }
    if (sector && sector !== '__all__') {
      rows = rows.filter((r) => (r.sector || '') === sector);
    }
    return rows;
  }, [grid, timeframe, tierSignal, freshOnly, search, sector]);

  const sortedTableRows = useMemo(() => {
    const rows = [...tableRows];
    const dir = sortDir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      const va = sortComparable(a, sortKey);
      const vb = sortComparable(b, sortKey);
      const emptyA = va === null || va === undefined || va === '';
      const emptyB = vb === null || vb === undefined || vb === '';
      if (emptyA && emptyB) return 0;
      if (emptyA) return 1;
      if (emptyB) return -1;
      if (typeof va === 'number' && typeof vb === 'number') {
        if (va === vb) return 0;
        return va < vb ? -dir : dir;
      }
      const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true, sensitivity: 'base' });
      if (cmp !== 0) return cmp * dir;
      return String(a.symbol || '').localeCompare(String(b.symbol || '')) * dir;
    });
    return rows;
  }, [tableRows, sortKey, sortDir]);

  const handleSortClick = (key) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  /** Same TradingView paste format as Short Term / Long Term / Advisor: `NSE:SYM,NSE:SYM,...` */
  const buildTradingViewSymbolsCsv = () => {
    const seen = new Set();
    const parts = [];
    for (const r of sortedTableRows) {
      const s = String(r.symbol || '').trim().toUpperCase();
      if (!s || seen.has(s)) continue;
      seen.add(s);
      parts.push(`NSE:${s}`);
    }
    return parts.join(',');
  };

  const copyCsv = async () => {
    const text = buildTradingViewSymbolsCsv();
    if (!text) {
      setSnack({ open: true, message: 'No symbols to copy' });
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setSnack({ open: true, message: `Copied ${text.split(',').length} symbols (TradingView CSV)` });
    } catch (_) {
      setSnack({
        open: true,
        message: 'Could not copy (use HTTPS or allow clipboard access)',
      });
    }
  };

  const segmentBtn = (active) => ({
    px: 1.75,
    py: 0.65,
    minWidth: 56,
    border: 'none',
    borderRight: BORDER,
    cursor: 'pointer',
    fontWeight: 800,
    fontSize: 12,
    fontFamily: 'inherit',
    bgcolor: active ? TF_BLUE : '#fff',
    color: active ? '#fff' : TF_BLUE,
    '&:last-of-type': { borderRight: 'none' },
    '&:hover': { bgcolor: active ? TF_BLUE : 'rgba(21,101,192,0.08)' },
  });

  return (
    <TableSection>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, mb: 1 }}>
        <Box>
          <TableTitle style={{ margin: 0 }}>Trend reversal</TableTitle>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 820 }}>
            Freedom-style filters: latest <strong>technical_signals</strong> bar per timeframe.{' '}
            <strong>B1–B3</strong> / <strong>S1–S3</strong> from the same engine as your screener. ⚡ Fresh = tier changed vs
            prior bar.
          </Typography>
        </Box>
        <Button
          size="small"
          variant="outlined"
          startIcon={loading ? <CircularProgress size={14} /> : <MdRefresh />}
          disabled={loading}
          onClick={() => load(true)}
          sx={{ textTransform: 'none' }}
        >
          Refresh
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && !error && grid && (
        <>
          {/* Toolbar row 1 — timeframe + buy tiers + fresh */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
            <Box sx={{ display: 'inline-flex', border: `1px solid ${TF_BLUE}`, borderRadius: '10px', overflow: 'hidden' }}>
              {TIMES.map((t) => (
                <Box
                  key={t.tf}
                  component="button"
                  type="button"
                  onClick={() => setTimeframe(t.tf)}
                  sx={segmentBtn(timeframe === t.tf)}
                >
                  {t.label}
                </Box>
              ))}
            </Box>
            <Box sx={{ display: 'inline-flex', border: `1px solid ${TF_BLUE}`, borderRadius: '10px', overflow: 'hidden' }}>
              {BUY_ROW.map((t) => (
                <Box
                  key={t.id}
                  component="button"
                  type="button"
                  onClick={() => setTierSignal(t.id)}
                  sx={segmentBtn(tierSignal === t.id)}
                >
                  {t.label}
                </Box>
              ))}
            </Box>
            <Button
              type="button"
              size="small"
              variant={freshOnly ? 'contained' : 'outlined'}
              onClick={() => setFreshOnly((v) => !v)}
              sx={{
                px: 1.5,
                fontWeight: 700,
                textTransform: 'none',
                borderColor: '#ff9800',
                color: freshOnly ? '#fff' : '#e65100',
                bgcolor: freshOnly ? '#ff9800' : '#fff3e0',
                boxShadow: 'none',
              }}
            >
              <MdBolt style={{ marginRight: 6, verticalAlign: 'middle' }} />
              Fresh only
            </Button>
          </Box>

          {/* SIGNAL row — sell tiers */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <Typography variant="caption" sx={{ fontWeight: 800, color: '#546e7a', mr: 0.5 }}>
              SIGNAL:
            </Typography>
            <Box sx={{ display: 'inline-flex', border: '1px solid #b71c1c', borderRadius: '10px', overflow: 'hidden' }}>
              {SELL_ROW.map((t) => {
                const on = tierSignal === t.id;
                return (
                  <Box
                    key={t.id}
                    component="button"
                    type="button"
                    onClick={() => setTierSignal(t.id)}
                    sx={{
                      px: 1.75,
                      py: 0.65,
                      minWidth: 48,
                      border: 'none',
                      borderRight: '1px solid #e57373',
                      cursor: 'pointer',
                      fontWeight: 800,
                      fontSize: 12,
                      fontFamily: 'inherit',
                      bgcolor: on ? '#b71c1c' : '#fff',
                      color: on ? '#fff' : '#b71c1c',
                      '&:last-of-type': { borderRight: 'none' },
                      '&:hover': { bgcolor: on ? '#b71c1c' : '#ffebee' },
                    }}
                  >
                    {t.label}
                  </Box>
                );
              })}
            </Box>
          </Box>

          {/* Search + sector + TradingView symbol list copy */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 2, alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder="Search symbol or company…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ minWidth: 220, flex: '1 1 200px' }}
            />
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Sector</InputLabel>
              <Select label="Sector" value={sector} onChange={(e) => setSector(e.target.value)}>
                <MenuItem value="__all__">All sectors</MenuItem>
                {sectorOptions.map((s) => (
                  <MenuItem key={s} value={s}>
                    {s}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Typography variant="body2" sx={{ alignSelf: 'center', color: 'text.secondary', fontWeight: 600 }}>
              All MCap
            </Typography>
            <Button variant="outlined" size="small" onClick={copyCsv} sx={{ textTransform: 'none' }}>
              Copy CSV
            </Button>
          </Box>

          {/* Card grid — 6 per timeframe */}
          {TIMES.map(({ tf, label }) => (
            <Box key={tf} sx={{ mb: 2 }}>
              <Typography variant="overline" sx={{ fontWeight: 800, color: '#546e7a' }}>
                {label}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 0.5 }}>
                {ALL_TIERS.map((tier) => {
                  const { count } = tierBlock(grid, tf, tier);
                  const isBuy = tier.startsWith('B');
                  const highlighted = timeframe === tf && tierSignal === tier;
                  const dim = timeframe !== tf;
                  return (
                    <Card
                      key={`${tf}-${tier}`}
                      elevation={1}
                      onClick={() => {
                        setTimeframe(tf);
                        setTierSignal(tier);
                      }}
                      sx={{
                        minWidth: 88,
                        flex: '0 0 auto',
                        cursor: 'pointer',
                        opacity: dim ? 0.55 : 1,
                        border: highlighted ? `2px solid ${TF_BLUE}` : BORDER,
                        borderColor: highlighted ? TF_BLUE : isBuy ? '#a5d6a7' : '#ffcdd2',
                        bgcolor: CARD_BG,
                        boxShadow: highlighted ? 3 : 0,
                      }}
                    >
                      <CardContent sx={{ py: 1.25, px: 1.5, '&:last-child': { pb: 1.25 } }}>
                        <Typography variant="caption" sx={{ fontWeight: 800, color: isBuy ? '#2e7d32' : '#c62828' }}>
                          {tf === 'daily' ? 'D' : tf === 'weekly' ? 'W' : 'M'} {tier}
                        </Typography>
                        {isBuy && BUY_HINT[tier] ? (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: 10 }}>
                            {BUY_HINT[tier]}
                          </Typography>
                        ) : null}
                        <Typography variant="h5" sx={{ fontWeight: 800, color: '#263238' }}>
                          {count}
                        </Typography>
                      </CardContent>
                    </Card>
                  );
                })}
              </Box>
            </Box>
          ))}

          <Typography variant="body2" sx={{ fontWeight: 700, color: '#37474f', mb: 0.5 }}>
            {sortedTableRows.length} results
          </Typography>
          {tableRows.length > 0 ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Sort: click a column header; click again to reverse (↑ / ↓). Works with any timeframe or signal filter.
            </Typography>
          ) : null}

          <Box sx={{ overflowX: 'auto', border: BORDER, borderRadius: 1, bgcolor: '#fff' }}>
            <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <Box component="thead" sx={{ bgcolor: '#1a3c5e' }}>
                <Box component="tr">
                  {TABLE_COLUMNS.map((col) => {
                    const active = sortKey === col.key;
                    return (
                      <Box
                        component="th"
                        key={col.key}
                        onClick={() => handleSortClick(col.key)}
                        sx={{
                          color: '#fff',
                          textAlign: 'left',
                          px: 1.25,
                          py: 1,
                          fontWeight: 700,
                          fontSize: 11,
                          whiteSpace: 'nowrap',
                          cursor: 'pointer',
                          userSelect: 'none',
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' },
                        }}
                      >
                        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.35 }}>
                          {col.label}
                          {active ? (
                            sortDir === 'asc' ? (
                              <MdArrowUpward style={{ fontSize: 14 }} />
                            ) : (
                              <MdArrowDownward style={{ fontSize: 14 }} />
                            )
                          ) : null}
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              </Box>
              <Box component="tbody">
                {tableRows.length === 0 ? (
                  <Box component="tr">
                    <Box component="td" colSpan={9} sx={{ p: 3, textAlign: 'center', color: '#9e9e9e' }}>
                      No rows match filters.
                    </Box>
                  </Box>
                ) : (
                  sortedTableRows.map((r) => {
                    const sig = String(r.buy_sell_tier || '').toUpperCase();
                    const isBuy = sig.startsWith('B');
                    const chg = formatChg(r.chg_pct);
                    return (
                      <Box component="tr" key={`${r.symbol}-${r.date}-${sig}`} sx={{ '&:nth-of-type(even)': { bgcolor: '#fafafa' } }}>
                        <Box component="td" sx={{ px: 1.25, py: 0.85, fontWeight: 700 }}>
                          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                            <TradingViewLink symbol={r.symbol} />
                            {r.symbol}
                          </Box>
                        </Box>
                        <Box component="td" sx={{ px: 1.25, py: 0.85, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.company}>
                          {r.company || '—'}
                        </Box>
                        <Box component="td" sx={{ px: 1.25, py: 0.85 }}>{formatMcap(r.market_cap)}</Box>
                        <Box component="td" sx={{ px: 1.25, py: 0.85 }}>{r.sector || '—'}</Box>
                        <Box component="td" sx={{ px: 1.25, py: 0.85 }}>{formatClose(r.close)}</Box>
                        <Box component="td" sx={{ px: 1.25, py: 0.85 }}>
                          <Box
                            component="span"
                            sx={{
                              display: 'inline-block',
                              px: 1,
                              py: 0.25,
                              borderRadius: 1,
                              fontWeight: 800,
                              fontSize: 11,
                              bgcolor: isBuy ? '#e8f5e9' : '#ffebee',
                              color: isBuy ? '#1b5e20' : '#b71c1c',
                            }}
                          >
                            {sig || '—'}
                          </Box>
                        </Box>
                        <Box
                          component="td"
                          sx={{
                            px: 1.25,
                            py: 0.85,
                            fontWeight: 600,
                            color: chg.pos === true ? '#2e7d32' : chg.pos === false ? '#c62828' : 'inherit',
                          }}
                        >
                          {chg.text}
                        </Box>
                        <Box component="td" sx={{ px: 1.25, py: 0.85 }}>{formatVol(r.volume)}</Box>
                        <Box component="td" sx={{ px: 1.25, py: 0.85, color: '#546e7a' }}>{r.date || '—'}</Box>
                      </Box>
                    );
                  })
                )}
              </Box>
            </Box>
          </Box>
        </>
      )}

      {!loading && !error && !grid && <Typography color="text.secondary">No data.</Typography>}

      <Snackbar
        open={snack.open}
        autoHideDuration={2600}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        message={snack.message}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </TableSection>
  );
}
