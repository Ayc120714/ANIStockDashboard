import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  MenuItem,
  Popover,
  TextField,
  Tooltip,
  Typography,
  Select,
  FormControl,
  InputLabel,
  Snackbar,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PsychologyOutlinedIcon from '@mui/icons-material/PsychologyOutlined';
import { MdArrowDownward, MdArrowUpward, MdBolt, MdRefresh } from 'react-icons/md';
import { TableSection, TableTitle, TableWrapper, Table } from './SectorOutlook.styles';
import { fetchAnalysisBrief, fetchBatchAnalysisContext, fetchBuyTierCardGrid } from '../api/advisor';
import { runScreenPayloadFetch } from '../utils/screenPageLoader';
import TradingViewLink from '../components/TradingViewLink';

const TF_BLUE = '#1565c0';
const BORDER = '1px solid #e0e0e0';
const CARD_BG = '#fafafa';
const compact = { fontSize: 12, padding: '4px 6px', whiteSpace: 'nowrap' };

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
  { key: 'reversal_context', label: 'REVERSAL SETUP' },
  { key: 'hold_months', label: 'HOLD' },
  { key: 'mcap', label: 'MCAP (CR)' },
  { key: 'sector', label: 'SECTOR' },
  { key: 'close', label: 'CLOSE' },
  { key: 'signal', label: 'SIGNAL' },
  { key: 'chg', label: 'CHG%' },
  { key: 'vol', label: 'VOL' },
  { key: 'date', label: 'DATE' },
];

const HOLD_MONTHS_FALLBACK = {
  daily: { B1: '1–2 months', B2: '2–3 months', B3: '3–4 months' },
  weekly: { B1: '3–4 months', B2: '4–6 months', B3: '6–8 months' },
  monthly: { B1: '6–8 months', B2: '8–12 months', B3: '12–18 months' },
};

function fallbackHoldMonths(row, timeframe) {
  const tier = String(row?.buy_sell_tier || '').toUpperCase();
  return HOLD_MONTHS_FALLBACK[timeframe]?.[tier] || '—';
}

const RATING_COLORS = {
  strong_buy: '#1b5e20',
  buy: '#2e7d32',
  hold: '#f57f17',
  sell: '#c62828',
  strong_sell: '#b71c1c',
};

function AiContextPopover({ symbol, context, anchorEl, onClose }) {
  const open = Boolean(anchorEl);
  if (!symbol) return null;
  const rating = String(context?.rating || '').toLowerCase().replace(/\s+/g, '_');
  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      slotProps={{ paper: { sx: { maxWidth: 380, p: 1.5 } } }}
    >
      <Typography variant="caption" sx={{ color: '#546e7a', display: 'block', mb: 0.5 }}>
        AI company context — same engine as <strong>Advisor → AI Analysis</strong> (Earnings)
      </Typography>
      {context?.loading ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
          <CircularProgress size={18} />
          <Typography variant="body2">Running AI analysis…</Typography>
        </Box>
      ) : null}
      {context?.error ? (
        <Typography variant="body2" color="error" sx={{ fontSize: 12 }}>
          {context.error}
        </Typography>
      ) : null}
      {!context?.loading && !context?.error && context?.summary ? (
        <>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 0.75 }}>
            {rating ? (
              <Chip
                size="small"
                label={rating.replace(/_/g, ' ').toUpperCase()}
                sx={{ bgcolor: RATING_COLORS[rating] || '#546e7a', color: '#fff', fontWeight: 700, fontSize: 10 }}
              />
            ) : null}
            {context.confidence != null ? (
              <Chip size="small" variant="outlined" label={`${context.confidence}% conf.`} sx={{ fontSize: 10 }} />
            ) : null}
            {context.from_cache ? (
              <Chip size="small" variant="outlined" label="cached" sx={{ fontSize: 10 }} />
            ) : null}
          </Box>
          <Typography variant="body2" sx={{ fontSize: 12, lineHeight: 1.45, color: '#37474f' }}>
            {context.summary}
          </Typography>
        </>
      ) : null}
      {!context?.loading && !context?.error && !context?.summary ? (
        <Typography variant="body2" sx={{ fontSize: 12, color: '#777' }}>
          No AI context yet. Use &quot;Run AI context&quot; above or open AI Analysis tab to analyse this symbol.
        </Typography>
      ) : null}
    </Popover>
  );
}

function fallbackReversalContext(row, timeframe) {
  const tier = String(row?.buy_sell_tier || '').toUpperCase();
  const prev = String(row?.prev_buy_sell_tier || '').toUpperCase();
  const fresh = row?.is_fresh ? 'Fresh ' : '';
  if (tier === 'B1') {
    if (prev.startsWith('S') && row?.is_fresh) {
      return `${fresh}${timeframe} reversal ${prev}→B1: sellers fading, early accumulation (RSI ~45–50, DI+ rising).`;
    }
    return `${fresh}${timeframe} B1: early bull reversal — buyers regaining control from weak momentum.`;
  }
  if (tier.startsWith('B')) {
    return `${fresh}${timeframe} ${tier}: bullish reversal setup active on technical tier.`;
  }
  if (tier.startsWith('S')) {
    return `${fresh}${timeframe} ${tier}: bearish reversal / distribution pressure on chart.`;
  }
  return '—';
}

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
    case 'reversal_context':
      return String(row.reversal_context || '').toLowerCase();
    case 'hold_months':
      return String(row.hold_months || '').toLowerCase();
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
  const [aiBySymbol, setAiBySymbol] = useState({});
  const [aiBatchLoading, setAiBatchLoading] = useState(false);
  const [aiPopover, setAiPopover] = useState({ symbol: null, anchorEl: null });

  const TREND_REVERSAL_CACHE = 'advisor_trend_reversal_grid_v2';

  const load = useCallback(async (refresh = false) => {
    await runScreenPayloadFetch({
      cacheKey: TREND_REVERSAL_CACHE,
      fetcher: async () => {
        const payload = await fetchBuyTierCardGrid({ refresh, symbol_limit: 800 });
        return payload?.data ?? null;
      },
      applyPayload: (data) => setGrid(data ?? null),
      setLoading,
      setError,
      forceNetwork: refresh,
      hasUsable: (p) => Boolean(p && (p.daily || p.weekly || p.monthly)),
    });
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

  const buyTierRows = useMemo(
    () => sortedTableRows.filter((r) => String(r.buy_sell_tier || '').toUpperCase().startsWith('B')),
    [sortedTableRows],
  );

  const loadAiContextForSymbol = useCallback((symbol, anchorEl) => {
    const sym = String(symbol || '').trim().toUpperCase();
    if (!sym) return;
    setAiPopover({ symbol: sym, anchorEl });
    setAiBySymbol((prev) => {
      const cur = prev[sym];
      if (cur?.summary || cur?.loading) return prev;
      (async () => {
        try {
          let brief = await fetchAnalysisBrief(sym, 'earnings');
          if (!brief?.summary) {
            const batch = await fetchBatchAnalysisContext({
              symbols: [sym],
              analysisType: 'earnings',
              refresh: false,
              maxSymbols: 1,
            });
            brief = batch?.data?.[0] || null;
          }
          if (!brief?.summary) {
            setAiBySymbol((p) => ({
              ...p,
              [sym]: { loading: false, error: 'AI analysis unavailable — add LLM keys in Profile.' },
            }));
            return;
          }
          setAiBySymbol((p) => ({
            ...p,
            [sym]: {
              loading: false,
              summary: brief.summary,
              rating: brief.rating,
              confidence: brief.confidence,
              from_cache: brief.from_cache,
            },
          }));
        } catch (e) {
          setAiBySymbol((p) => ({
            ...p,
            [sym]: { loading: false, error: e?.message || 'Failed to load AI context' },
          }));
        }
      })();
      return { ...prev, [sym]: { ...(prev[sym] || {}), loading: true, error: null } };
    });
  }, []);

  const runBatchAiContext = useCallback(async () => {
    const symbols = [...new Set(buyTierRows.map((r) => String(r.symbol || '').toUpperCase()).filter(Boolean))].slice(0, 12);
    if (!symbols.length) {
      setSnack({ open: true, message: 'No buy-tier stocks in current filter' });
      return;
    }
    setAiBatchLoading(true);
    try {
      const res = await fetchBatchAnalysisContext({
        symbols,
        analysisType: 'earnings',
        refresh: false,
        maxSymbols: 12,
      });
      const next = {};
      (res?.data || []).forEach((row) => {
        const sym = String(row.symbol || '').toUpperCase();
        if (!sym) return;
        next[sym] = {
          loading: false,
          summary: row.summary,
          rating: row.rating,
          confidence: row.confidence,
          from_cache: row.from_cache,
        };
      });
      setAiBySymbol((prev) => ({ ...prev, ...next }));
      const errN = (res?.errors || []).length;
      setSnack({
        open: true,
        message: errN
          ? `AI context loaded for ${res?.count || 0} stocks (${errN} failed). Click ⓘ on a row to read.`
          : `AI context ready for ${res?.count || 0} stocks — click ⓘ on any row for popup.`,
      });
    } catch (e) {
      setSnack({ open: true, message: e?.message || 'Batch AI analysis failed' });
    } finally {
      setAiBatchLoading(false);
    }
  }, [buyTierRows]);

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
        <TableTitle style={{ margin: 0 }}>Trend reversal</TableTitle>
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
            <Tooltip title="Run earnings AI analysis (Advisor → AI Analysis tab) for buy-tier stocks in this filter. Click ⓘ on a row for popup context.">
              <span>
                <Button
                  variant="contained"
                  size="small"
                  disabled={aiBatchLoading || buyTierRows.length === 0}
                  onClick={runBatchAiContext}
                  startIcon={aiBatchLoading ? <CircularProgress size={14} color="inherit" /> : <PsychologyOutlinedIcon sx={{ fontSize: 16 }} />}
                  sx={{ textTransform: 'none', bgcolor: '#4527a0', '&:hover': { bgcolor: '#311b92' } }}
                >
                  {aiBatchLoading ? 'Analysing…' : `Run AI context (${Math.min(buyTierRows.length, 12)})`}
                </Button>
              </span>
            </Tooltip>
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
          <TableWrapper>
            <Table style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  {TABLE_COLUMNS.map((col) => {
                    const active = sortKey === col.key;
                    return (
                      <th
                        key={col.key}
                        style={{ ...compact, color: '#fff', cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => handleSortClick(col.key)}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          {col.label}
                          {active ? (
                            sortDir === 'asc' ? <MdArrowUpward size={14} /> : <MdArrowDownward size={14} />
                          ) : null}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {tableRows.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ padding: 24, textAlign: 'center', color: '#9e9e9e' }}>
                      No rows match filters.
                    </td>
                  </tr>
                ) : (
                  sortedTableRows.map((r) => {
                    const sig = String(r.buy_sell_tier || '').toUpperCase();
                    const isBuy = sig.startsWith('B');
                    const chg = formatChg(r.chg_pct);
                    return (
                      <tr key={`${r.symbol}-${r.date}-${sig}`}>
                        <td style={{ ...compact, fontWeight: 700 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            {r.symbol}
                            <TradingViewLink symbol={r.symbol} />
                            {isBuy ? (
                              <Tooltip title="AI company context (popup)">
                                <IconButton
                                  size="small"
                                  onClick={(e) => loadAiContextForSymbol(r.symbol, e.currentTarget)}
                                  sx={{
                                    p: 0.25,
                                    color: aiBySymbol[r.symbol]?.summary ? '#4527a0' : '#90a4ae',
                                  }}
                                >
                                  <InfoOutlinedIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                            ) : null}
                          </span>
                        </td>
                        <td style={{ ...compact, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.company}>
                          {r.company || '—'}
                        </td>
                        <td
                          style={{ ...compact, maxWidth: 360, fontSize: 11, color: '#455a64', lineHeight: 1.35, whiteSpace: 'normal' }}
                          title={r.reversal_context || fallbackReversalContext(r, timeframe)}
                        >
                          {r.reversal_context || fallbackReversalContext(r, timeframe)}
                        </td>
                        <td style={{ ...compact, fontWeight: 700, color: isBuy ? '#1b5e20' : '#b71c1c' }}>
                          {r.hold_months || fallbackHoldMonths(r, timeframe)}
                        </td>
                        <td style={compact}>{formatMcap(r.market_cap)}</td>
                        <td style={compact}>{r.sector || '—'}</td>
                        <td style={compact}>{formatClose(r.close)}</td>
                        <td style={compact}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: 4,
                              fontWeight: 800,
                              fontSize: 11,
                              background: isBuy ? '#e8f5e9' : '#ffebee',
                              color: isBuy ? '#1b5e20' : '#b71c1c',
                            }}
                          >
                            {sig || '—'}
                          </span>
                        </td>
                        <td
                          style={{
                            ...compact,
                            fontWeight: 600,
                            color: chg.pos === true ? '#2e7d32' : chg.pos === false ? '#c62828' : 'inherit',
                          }}
                        >
                          {chg.text}
                        </td>
                        <td style={compact}>{formatVol(r.volume)}</td>
                        <td style={{ ...compact, color: '#546e7a' }}>{r.date || '—'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </Table>
          </TableWrapper>
        </>
      )}

      {!loading && !error && !grid && <Typography color="text.secondary">No data.</Typography>}

      <AiContextPopover
        symbol={aiPopover.symbol}
        context={aiPopover.symbol ? aiBySymbol[aiPopover.symbol] : null}
        anchorEl={aiPopover.anchorEl}
        onClose={() => setAiPopover({ symbol: null, anchorEl: null })}
      />

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
