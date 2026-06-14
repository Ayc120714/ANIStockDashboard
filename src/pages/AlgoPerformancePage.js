import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Divider,
  FormControlLabel,
  FormGroup,
  Grid,
  MenuItem,
  Paper,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { MdExpandMore, MdOutlineUploadFile } from 'react-icons/md';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '../auth/AuthContext';
import { ALGO_PLAYBOOK, TAX_CHECKLIST_ITEMS } from '../constants/algoPerformanceAdmin';

const ALGOS = ['ALGO1', 'ALGO2', 'ALGO3', 'ALGO4', 'ALGO5'];
const TAX_LS_KEY = 'algo_perf_tax_checklist_v1';
const CSV_CANDIDATES = ['algo_trades_last4y.csv', 'algo_trades.csv'];

/** Presets for the "Quick sort" dropdown (must match keys below). */
const ALGO_SORT_PRESETS = {
  trades_desc: { key: 'trades', dir: 'desc' },
  trades_asc: { key: 'trades', dir: 'asc' },
  winpct_desc: { key: 'winpct', dir: 'desc' },
  avgr_desc: { key: 'avgr', dir: 'desc' },
  algo_asc: { key: 'algo', dir: 'asc' },
};

const fmt = (v, d = 2) => {
  if (v == null || v === '') return '—';
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(d) : '—';
};

/** Parse CSV; header row required. */
function parseCsv(text) {
  const rows = [];
  let i = 0;
  const len = text.length;
  let row = [];
  let cur = '';
  let inQ = false;
  while (i < len) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQ = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQ = true;
    } else if (c === ',') {
      row.push(cur);
      cur = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cur);
      if (row.some((x) => String(x).trim().length)) rows.push(row);
      row = [];
      cur = '';
    } else {
      cur += c;
    }
    i += 1;
  }
  if (cur.length || row.length) {
    row.push(cur);
    if (row.some((x) => String(x).trim().length)) rows.push(row);
  }
  if (!rows.length) return { headers: [], records: [] };
  const headers = rows[0].map((h) => String(h).trim());
  const records = [];
  for (let r = 1; r < rows.length; r += 1) {
    const line = rows[r];
    if (line.length < headers.length) continue;
    const o = {};
    for (let j = 0; j < headers.length; j += 1) {
      o[headers[j]] = line[j] != null ? String(line[j]).trim() : '';
    }
    records.push(o);
  }
  return { headers, records };
}

function inferSide(rec) {
  const s = (rec.Side || rec.side || '').toUpperCase();
  if (s === 'LONG' || s === 'SHORT') return s;
  const t = (rec.Target || '').toUpperCase();
  if (t.includes('S1') || t.includes('S2') || t.includes('S3')) return 'SHORT';
  if (t.includes('R1') || t.includes('R2') || t.includes('R3')) return 'LONG';
  return '';
}

/** Normalize one CSV row so old exports (without ExitDate/Side) still load. */
function normalizeTrade(rec) {
  const entryDate = rec.EntryDate || rec.Date || rec.date || '';
  const exitDate = rec.ExitDate || rec.exit_date || '';
  const side = inferSide(rec);
  return {
    ...rec,
    _entryDate: entryDate,
    _exitDate: exitDate,
    _side: side,
  };
}

function aggregate(records) {
  const overall = { trades: 0, wins: 0, losses: 0, be: 0, sumR: 0, sumPct: 0 };
  const byAlgo = {};
  ALGOS.forEach((a) => {
    byAlgo[a] = { trades: 0, wins: 0, losses: 0, be: 0, sumR: 0, sumPct: 0 };
  });
  const byTicker = {};

  records.forEach((rec) => {
    const sym = rec.Stock || rec.stock || '';
    const algo = rec.Algo || rec.algo || '';
    const wl = rec['Win/Loss'] || '';
    const r = parseFloat(rec['R:R Actual']);
    const pct = parseFloat(rec['% Gain']);

    overall.trades += 1;
    if (wl === 'Win') overall.wins += 1;
    else if (wl === 'Loss') overall.losses += 1;
    else overall.be += 1;
    if (!Number.isNaN(r)) overall.sumR += r;
    if (!Number.isNaN(pct)) overall.sumPct += pct;

    if (byAlgo[algo]) {
      const A = byAlgo[algo];
      A.trades += 1;
      if (wl === 'Win') A.wins += 1;
      else if (wl === 'Loss') A.losses += 1;
      else A.be += 1;
      if (!Number.isNaN(r)) A.sumR += r;
      if (!Number.isNaN(pct)) A.sumPct += pct;
    }

    if (!byTicker[sym]) {
      byTicker[sym] = {
        trades: 0,
        wins: 0,
        losses: 0,
        be: 0,
        sumR: 0,
        algo: {},
      };
      ALGOS.forEach((a) => {
        byTicker[sym].algo[a] = { trades: 0, wins: 0, losses: 0, be: 0, sumR: 0 };
      });
    }
    const T = byTicker[sym];
    T.trades += 1;
    if (wl === 'Win') T.wins += 1;
    else if (wl === 'Loss') T.losses += 1;
    else T.be += 1;
    if (!Number.isNaN(r)) T.sumR += r;
    if (T.algo[algo]) {
      const G = T.algo[algo];
      G.trades += 1;
      if (wl === 'Win') G.wins += 1;
      else if (wl === 'Loss') G.losses += 1;
      else G.be += 1;
      if (!Number.isNaN(r)) G.sumR += r;
    }
  });

  return { overall, byAlgo, byTicker };
}

function parseYmd(s) {
  if (!s || typeof s !== 'string') return 0;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return 0;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return 0;
  return y * 10000 + mo * 100 + d;
}

function winLoss(rec) {
  return rec['Win/Loss'] || '';
}

function symbolHistogram(rows) {
  const m = new Map();
  rows.forEach((r) => {
    const s = r.Stock || '';
    if (!s) return;
    m.set(s, (m.get(s) || 0) + 1);
  });
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function averageR(rows) {
  const xs = rows.map((r) => parseFloat(r['R:R Actual'])).filter(Number.isFinite);
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/**
 * Per-algo detail: separate tabs for trades that went well vs those that did not (loss + BE).
 */
function AlgoDeepDivePanel({ algoId, rows, playbook }) {
  const [subTab, setSubTab] = useState(0);
  const [detailPage, setDetailPage] = useState(0);
  const [detailRowsPerPage, setDetailRowsPerPage] = useState(25);

  const wellRows = useMemo(
    () =>
      [...rows]
        .filter((r) => winLoss(r) === 'Win')
        .sort((a, b) => parseFloat(b['R:R Actual']) - parseFloat(a['R:R Actual'])),
    [rows],
  );

  const poorRows = useMemo(
    () =>
      [...rows]
        .filter((r) => winLoss(r) !== 'Win')
        .sort((a, b) => parseFloat(a['R:R Actual']) - parseFloat(b['R:R Actual'])),
    [rows],
  );

  const winSyms = useMemo(() => symbolHistogram(wellRows).slice(0, 15), [wellRows]);
  const lossSyms = useMemo(() => symbolHistogram(poorRows).slice(0, 15), [poorRows]);

  const stats = useMemo(() => {
    const n = rows.length;
    const nw = wellRows.length;
    const losses = poorRows.filter((r) => winLoss(r) === 'Loss').length;
    const be = poorRows.filter((r) => winLoss(r) === 'BE').length;
    const wr = n ? (100 * nw) / n : 0;
    return { n, nw, losses, be, wr, avgWinR: averageR(wellRows), avgLossR: averageR(poorRows.filter((r) => winLoss(r) === 'Loss')) };
  }, [rows.length, wellRows, poorRows]);

  const insights = useMemo(() => {
    const lines = [];
    if (stats.n === 0) return ['No trades for this algo in the loaded CSV.'];
    lines.push(
      `In this export: ${stats.n.toLocaleString()} trades · ${fmt(stats.wr, 1)}% win rate (${stats.nw} wins, ${stats.losses} losses, ${stats.be} BE).`,
    );
    if (stats.avgWinR != null) lines.push(`Average R on winning trades: ${fmt(stats.avgWinR, 3)}.`);
    if (stats.losses > 0 && stats.avgLossR != null) lines.push(`Average R on losing trades: ${fmt(stats.avgLossR, 3)}.`);
    if (winSyms.length)
      lines.push(`Symbols showing up most often on wins: ${winSyms.slice(0, 6).map(([s, c]) => `${s} (${c})`).join(', ')}.`);
    if (lossSyms.length)
      lines.push(`Symbols showing up most often on losses / BE: ${lossSyms.slice(0, 6).map(([s, c]) => `${s} (${c})`).join(', ')}.`);
    return lines;
  }, [stats, winSyms, lossSyms]);

  const activeRows = subTab === 0 ? wellRows : poorRows;

  const pagedDetail = useMemo(() => {
    const start = detailPage * detailRowsPerPage;
    return activeRows.slice(start, start + detailRowsPerPage);
  }, [activeRows, detailPage, detailRowsPerPage]);

  useEffect(() => {
    setDetailPage(0);
  }, [subTab, algoId]);

  const pb = playbook || {};

  return (
    <Box>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, color: '#1e3a8a', mb: 1 }}>
          {algoId} — {pb.title || 'Detail'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {pb.timeframe ? `${pb.timeframe}. ` : ''}
          Compare trades that matched the setup outcome vs those that did not. Entry / exit days come from the verifier CSV
          (<strong>EntryDate</strong>, <strong>ExitDate</strong>).
        </Typography>
        <Grid container spacing={1.5} sx={{ mb: 2 }}>
          <Grid item xs={6} sm={4} md={2}>
            <Card variant="outlined">
              <CardContent sx={{ py: 1.25, '&:last-child': { pb: 1.25 } }}>
                <Typography variant="caption" color="text.secondary">
                  Trades (sample)
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  {stats.n.toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <Card variant="outlined">
              <CardContent sx={{ py: 1.25, '&:last-child': { pb: 1.25 } }}>
                <Typography variant="caption" color="text.secondary">
                  Win rate
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  {fmt(stats.wr, 1)}%
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <Card variant="outlined">
              <CardContent sx={{ py: 1.25, '&:last-child': { pb: 1.25 } }}>
                <Typography variant="caption" color="text.secondary">
                  Wins / Loss / BE
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  {stats.nw} / {stats.losses} / {stats.be}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
        <Alert severity="info" sx={{ mb: 2 }}>
          {insights.map((line, i) => (
            <Typography key={i} variant="body2" sx={{ mb: 0.5 }}>
              {line}
            </Typography>
          ))}
        </Alert>
      </Paper>

      <Paper sx={{ mb: 2 }}>
        <Tabs value={subTab} onChange={(_, v) => setSubTab(v)} sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
          <Tab label="Where it went well" />
          <Tab label="Where it did not (loss & BE)" />
        </Tabs>
        <Box sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {subTab === 0 ? (
              <>
                <strong>Guide — strengths:</strong> {pb.whereItExcels || '—'}
              </>
            ) : (
              <>
                <strong>Guide — risks:</strong> {pb.whereItStruggles || '—'}
              </>
            )}
          </Typography>
          <TableContainer sx={{ maxHeight: 440 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Entry date</TableCell>
                  <TableCell>Exit date</TableCell>
                  <TableCell>Side</TableCell>
                  <TableCell>Stock</TableCell>
                  <TableCell align="right">Entry</TableCell>
                  <TableCell align="right">Exit</TableCell>
                  <TableCell align="right">SL</TableCell>
                  <TableCell>Outcome</TableCell>
                  <TableCell align="right">R</TableCell>
                  <TableCell align="right">% Gain</TableCell>
                  <TableCell>Notes</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pagedDetail.map((row, idx) => (
                  <TableRow key={`${row._entryDate}-${row.Stock}-${idx}`}>
                    <TableCell>{row._entryDate || '—'}</TableCell>
                    <TableCell>{row._exitDate || '—'}</TableCell>
                    <TableCell>{row._side || '—'}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{row.Stock}</TableCell>
                    <TableCell align="right">{fmt(row.Entry, 4)}</TableCell>
                    <TableCell align="right">{fmt(row.Exit, 4)}</TableCell>
                    <TableCell align="right">{fmt(row.SL, 4)}</TableCell>
                    <TableCell>{row['Win/Loss']}</TableCell>
                    <TableCell align="right">{fmt(row['R:R Actual'], 3)}</TableCell>
                    <TableCell align="right">{fmt(row['% Gain'], 3)}%</TableCell>
                    <TableCell sx={{ maxWidth: 160 }}>{row.Notes}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={activeRows.length}
            page={detailPage}
            onPageChange={(_, p) => setDetailPage(p)}
            rowsPerPage={detailRowsPerPage}
            onRowsPerPageChange={(e) => {
              setDetailRowsPerPage(parseInt(e.target.value, 10));
              setDetailPage(0);
            }}
            rowsPerPageOptions={[15, 25, 50, 100]}
          />
        </Box>
      </Paper>
    </Box>
  );
}

function AlgoPerformancePage() {
  const { isAdmin } = useAuth();
  const [records, setRecords] = useState([]);
  const [fileName, setFileName] = useState('');
  const [loadError, setLoadError] = useState(null);
  const [autoLoadMsg, setAutoLoadMsg] = useState('');
  const [tickerFilter, setTickerFilter] = useState('');
  const [sortMode, setSortMode] = useState('trades-desc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [algoSortBy, setAlgoSortBy] = useState('trades');
  const [algoSortDir, setAlgoSortDir] = useState('desc');

  const [ledgerAlgo, setLedgerAlgo] = useState('ALL');
  const [ledgerSort, setLedgerSort] = useState('entry-desc');
  const [ledgerPage, setLedgerPage] = useState(0);
  const [ledgerRowsPerPage, setLedgerRowsPerPage] = useState(50);
  const [mainTab, setMainTab] = useState(0);

  const [taxChecked, setTaxChecked] = useState(() => {
    try {
      const raw = localStorage.getItem(TAX_LS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const persistTax = useCallback((next) => {
    setTaxChecked(next);
    try {
      localStorage.setItem(TAX_LS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const normalizedRecords = useMemo(() => records.map(normalizeTrade), [records]);

  const tryLoadPublicCsv = useCallback(async () => {
    const base = process.env.PUBLIC_URL || '';
    for (const name of CSV_CANDIDATES) {
      try {
        const url = `${base}/${name}`.replace(/\/{2,}/g, '/');
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) continue;
        const text = await res.text();
        const { records: recs } = parseCsv(text);
        if (recs.length) {
          setRecords(recs.map(normalizeTrade));
          setFileName(`${name} (public auto-load)`);
          setLoadError(null);
          setAutoLoadMsg(`Auto-loaded ${recs.length.toLocaleString()} rows from public/${name}`);
          return;
        }
      } catch {
        /* try next */
      }
    }
    setAutoLoadMsg('');
  }, []);

  useEffect(() => {
    tryLoadPublicCsv();
  }, [tryLoadPublicCsv]);

  const agg = useMemo(() => aggregate(normalizedRecords), [normalizedRecords]);

  const algoRows = useMemo(() => {
    const rows = ALGOS.map((a) => {
      const x = agg.byAlgo[a];
      const winpct = x.trades ? (100 * x.wins) / x.trades : 0;
      const avgr = x.trades ? x.sumR / x.trades : 0;
      const avgp = x.trades ? x.sumPct / x.trades : 0;
      return {
        algo: a,
        trades: x.trades,
        wins: x.wins,
        losses: x.losses,
        be: x.be,
        winpct,
        avgr,
        avgpct: avgp,
      };
    });
    const mul = algoSortDir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      const va = a[algoSortBy];
      const vb = b[algoSortBy];
      if (typeof va === 'string') return mul * String(va).localeCompare(String(vb));
      return mul * (va - vb);
    });
    return rows;
  }, [agg.byAlgo, algoSortBy, algoSortDir]);

  const chartCountData = useMemo(
    () =>
      ALGOS.map((a) => ({
        name: a.replace('ALGO', 'A'),
        trades: agg.byAlgo[a].trades,
      })),
    [agg.byAlgo],
  );

  const chartWinData = useMemo(
    () =>
      ALGOS.map((a) => {
        const x = agg.byAlgo[a];
        return {
          name: a.replace('ALGO', 'A'),
          winpct: x.trades ? (100 * x.wins) / x.trades : 0,
        };
      }),
    [agg.byAlgo],
  );

  const tickerRows = useMemo(() => {
    let syms = Object.keys(agg.byTicker);
    const f = tickerFilter.trim().toLowerCase();
    if (f) syms = syms.filter((s) => s.toLowerCase().includes(f));
    const rows = syms.map((sym) => {
      const T = agg.byTicker[sym];
      const winpct = T.trades ? (100 * T.wins) / T.trades : 0;
      const avgr = T.trades ? T.sumR / T.trades : 0;
      const algoCells = ALGOS.map((a) => {
        const g = T.algo[a];
        if (!g.trades) return '—';
        const wp = (100 * g.wins) / g.trades;
        return `${g.trades} (${fmt(wp, 0)}%)`;
      });
      return {
        sym,
        trades: T.trades,
        wins: T.wins,
        losses: T.losses,
        be: T.be,
        winpct,
        avgr,
        algoCells,
      };
    });
    rows.sort((a, b) => {
      switch (sortMode) {
        case 'trades-asc':
          return a.trades - b.trades;
        case 'sym-asc':
          return a.sym.localeCompare(b.sym);
        case 'winpct-desc':
          return b.winpct - a.winpct;
        case 'avgr-desc':
          return b.avgr - a.avgr;
        case 'trades-desc':
        default:
          return b.trades - a.trades;
      }
    });
    return rows;
  }, [agg.byTicker, tickerFilter, sortMode]);

  const pagedTickers = useMemo(() => {
    const start = page * rowsPerPage;
    return tickerRows.slice(start, start + rowsPerPage);
  }, [tickerRows, page, rowsPerPage]);

  const ledgerRows = useMemo(() => {
    let list = normalizedRecords;
    if (ledgerAlgo !== 'ALL') list = list.filter((r) => (r.Algo || '') === ledgerAlgo);
    const sorted = [...list];
    sorted.sort((a, b) => {
      const ea = parseYmd(a._entryDate);
      const eb = parseYmd(b._entryDate);
      const xa = parseYmd(a._exitDate);
      const xb = parseYmd(b._exitDate);
      switch (ledgerSort) {
        case 'entry-asc':
          return ea - eb || (a.Stock || '').localeCompare(b.Stock || '');
        case 'entry-desc':
          return eb - ea || (a.Stock || '').localeCompare(b.Stock || '');
        case 'exit-asc':
          return xa - xb || eb - ea;
        case 'exit-desc':
          return xb - xa || eb - ea;
        default:
          return eb - ea;
      }
    });
    return sorted;
  }, [normalizedRecords, ledgerAlgo, ledgerSort]);

  const pagedLedger = useMemo(() => {
    const start = ledgerPage * ledgerRowsPerPage;
    return ledgerRows.slice(start, start + ledgerRowsPerPage);
  }, [ledgerRows, ledgerPage, ledgerRowsPerPage]);

  const handleFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setLoadError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const { records: recs } = parseCsv(String(reader.result || ''));
        if (!recs.length) throw new Error('No data rows found.');
        setRecords(recs.map(normalizeTrade));
        setFileName(f.name);
        setPage(0);
        setLedgerPage(0);
        setMainTab(0);
        setAutoLoadMsg('');
      } catch (err) {
        setLoadError(err.message || 'Could not parse CSV.');
      }
    };
    reader.readAsText(f, 'UTF-8');
    e.target.value = '';
  };

  const overall = agg.overall;
  const winpctAll = overall.trades ? (100 * overall.wins) / overall.trades : 0;
  const avgrAll = overall.trades ? overall.sumR / overall.trades : 0;
  const avgpAll = overall.trades ? overall.sumPct / overall.trades : 0;
  const nTickers = Object.keys(agg.byTicker).length;

  const handleAlgoSort = (key) => {
    if (algoSortBy === key) {
      setAlgoSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setAlgoSortBy(key);
      setAlgoSortDir('desc');
    }
  };

  const algoQuickSortValue = useMemo(() => {
    for (const [presetId, cfg] of Object.entries(ALGO_SORT_PRESETS)) {
      if (cfg.key === algoSortBy && cfg.dir === algoSortDir) return presetId;
    }
    return '';
  }, [algoSortBy, algoSortDir]);

  return (
    <Box sx={{ maxWidth: 1320, mx: 'auto' }}>
      <Typography variant="h5" sx={{ fontWeight: 800, color: '#1e3a8a', mb: 0.5 }}>
        Algo performance review
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Drop <strong>algo_trades_last4y.csv</strong> into <code>public/</code> for automatic loading, or use{' '}
        <strong>Load CSV</strong>. Verifier exports use <strong>EntryDate</strong>, <strong>ExitDate</strong>, and{' '}
        <strong>Side</strong>. Use per-algo tabs below for “went well” vs “did not” breakdowns.
      </Typography>

      {autoLoadMsg ? (
        <Alert severity="success" sx={{ mb: 2 }}>
          {autoLoadMsg}
        </Alert>
      ) : null}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          <Button variant="contained" component="label" startIcon={<MdOutlineUploadFile />}>
            Load CSV
            <input type="file" accept=".csv,text/csv" hidden onChange={handleFile} />
          </Button>
          <Button variant="outlined" size="small" onClick={() => tryLoadPublicCsv()}>
            Retry auto-load from public/
          </Button>
          {fileName ? (
            <Typography variant="body2" color="text.secondary">
              Loaded: <strong>{fileName}</strong> · {records.length.toLocaleString()} trades
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No file loaded yet.
            </Typography>
          )}
        </Box>
        {loadError ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            {loadError}
          </Alert>
        ) : null}
      </Paper>

      {isAdmin ? (
        <Paper sx={{ p: 2, mb: 2, border: '1px dashed rgba(37, 99, 235, 0.35)' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#1e3a8a', mb: 1 }}>
            Admin — setups, blocks & tax checklist
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Visible only to admin users. Maps each algo to TradingView / Pine indicator files from your implementation
            guide. Tax items are a checklist for bookkeeping (not tax advice).
          </Typography>

          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
            Tax / reporting toggles (saved in this browser)
          </Typography>
          <FormGroup row sx={{ flexWrap: 'wrap', gap: 1, mb: 2 }}>
            {TAX_CHECKLIST_ITEMS.map((item) => (
              <FormControlLabel
                key={item.key}
                control={
                  <Checkbox
                    checked={Boolean(taxChecked[item.key])}
                    onChange={(ev) =>
                      persistTax({ ...taxChecked, [item.key]: ev.target.checked })
                    }
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {item.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.detail}
                    </Typography>
                  </Box>
                }
              />
            ))}
          </FormGroup>

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
            Which indicator block supports which algo
          </Typography>
          {ALGOS.map((id) => {
            const pb = ALGO_PLAYBOOK[id];
            if (!pb) return null;
            return (
              <Accordion key={id} disableGutters>
                <AccordionSummary expandIcon={<MdExpandMore />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip label={id} size="small" color="primary" variant="outlined" />
                    <Typography sx={{ fontWeight: 700 }}>{pb.title}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {pb.timeframe}
                    </Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    {pb.whenToUse}
                  </Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Blocks / files
                  </Typography>
                  <ul style={{ marginTop: 8 }}>
                    {pb.indicatorBlocks.map((b) => (
                      <li key={b}>
                        <Typography variant="body2">{b}</Typography>
                      </li>
                    ))}
                  </ul>
                </AccordionDetails>
              </Accordion>
            );
          })}
        </Paper>
      ) : null}

      {!records.length ? (
        <Alert severity="info">
          Upload a CSV with columns: EntryDate, ExitDate, Side, Algo, Stock, Entry, Exit, SL, Target, R:R Actual,
          Win/Loss, % Gain, Notes. Legacy files may still use &quot;Date&quot; instead of EntryDate.
        </Alert>
      ) : (
        <>
          <Paper sx={{ mb: 2 }}>
            <Tabs
              value={mainTab}
              onChange={(_, v) => setMainTab(v)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ px: 1, borderBottom: 1, borderColor: 'divider' }}
            >
              <Tab label="Overview" />
              {ALGOS.map((a) => (
                <Tab key={a} label={`${a} · detail`} />
              ))}
            </Tabs>
          </Paper>

          {mainTab >= 1 ? (
            <AlgoDeepDivePanel
              algoId={ALGOS[mainTab - 1]}
              rows={normalizedRecords.filter((r) => (r.Algo || '') === ALGOS[mainTab - 1])}
              playbook={ALGO_PLAYBOOK[ALGOS[mainTab - 1]]}
            />
          ) : null}

          {mainTab === 0 ? (
            <>
          <Grid container spacing={1.5} sx={{ mb: 2 }}>
            {[
              { label: 'Total trades', value: overall.trades.toLocaleString() },
              { label: 'Win rate', value: `${fmt(winpctAll, 2)}%` },
              { label: 'Wins / Loss / BE', value: `${overall.wins} / ${overall.losses} / ${overall.be}` },
              { label: 'Avg R (all)', value: fmt(avgrAll, 3) },
              { label: 'Avg % gain (all)', value: `${fmt(avgpAll, 3)}%` },
              { label: 'Tickers', value: nTickers.toLocaleString() },
            ].map((k) => (
              <Grid item xs={6} sm={4} md={2} key={k.label}>
                <Card variant="outlined" sx={{ height: '100%' }}>
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                      {k.label}
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#1e3a8a' }}>
                      {k.value}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, height: 320 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1e3a8a', mb: 1 }}>
                  Trades by algo
                </Typography>
                <ResponsiveContainer width="100%" height="85%">
                  <BarChart data={chartCountData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.35)" />
                    <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#475569', fontSize: 12 }} allowDecimals={false} />
                    <RTooltip />
                    <Bar dataKey="trades" fill="#2563eb" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, height: 320 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1e3a8a', mb: 1 }}>
                  Win rate by algo (%)
                </Typography>
                <ResponsiveContainer width="100%" height="85%">
                  <BarChart layout="vertical" data={chartWinData} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.35)" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fill: '#475569', fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
                    <YAxis type="category" dataKey="name" width={36} tick={{ fill: '#475569', fontSize: 12 }} />
                    <RTooltip formatter={(v) => [`${fmt(v, 2)}%`, 'Win %']} />
                    <Bar dataKey="winpct" fill="#16a34a" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
          </Grid>

          <Paper sx={{ mb: 2 }}>
            <Box sx={{ px: 2, pt: 2, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1e3a8a' }}>
                Summary by algo
              </Typography>
              <TextField
                select
                size="small"
                label="Quick sort"
                value={algoQuickSortValue}
                displayEmpty
                onChange={(e) => {
                  const cfg = ALGO_SORT_PRESETS[e.target.value];
                  if (cfg) {
                    setAlgoSortBy(cfg.key);
                    setAlgoSortDir(cfg.dir);
                  }
                }}
                sx={{ minWidth: 220 }}
              >
                <MenuItem value="">Custom (use column headers)</MenuItem>
                <MenuItem value="trades_desc">Trades (high → low)</MenuItem>
                <MenuItem value="trades_asc">Trades (low → high)</MenuItem>
                <MenuItem value="winpct_desc">Win % (high → low)</MenuItem>
                <MenuItem value="avgr_desc">Avg R (high → low)</MenuItem>
                <MenuItem value="algo_asc">Algo name A–Z</MenuItem>
              </TextField>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>
                      <TableSortLabel
                        active={algoSortBy === 'algo'}
                        direction={algoSortBy === 'algo' ? algoSortDir : 'asc'}
                        onClick={() => handleAlgoSort('algo')}
                      >
                        Algo
                      </TableSortLabel>
                    </TableCell>
                    {[
                      { key: 'trades', label: 'Trades' },
                      { key: 'wins', label: 'Wins' },
                      { key: 'losses', label: 'Losses' },
                      { key: 'be', label: 'BE' },
                      { key: 'winpct', label: 'Win %' },
                      { key: 'avgr', label: 'Avg R' },
                      { key: 'avgpct', label: 'Avg % gain' },
                    ].map((col) => (
                      <TableCell key={col.key} align="right">
                        <TableSortLabel
                          active={algoSortBy === col.key}
                          direction={algoSortBy === col.key ? algoSortDir : 'asc'}
                          onClick={() => handleAlgoSort(col.key)}
                        >
                          {col.label}
                        </TableSortLabel>
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {algoRows.map((r) => (
                    <TableRow key={r.algo} hover>
                      <TableCell sx={{ fontWeight: 700 }}>{r.algo}</TableCell>
                      <TableCell align="right">{r.trades.toLocaleString()}</TableCell>
                      <TableCell align="right" sx={{ color: '#15803d', fontWeight: 600 }}>
                        {r.wins.toLocaleString()}
                      </TableCell>
                      <TableCell align="right" sx={{ color: '#b91c1c', fontWeight: 600 }}>
                        {r.losses.toLocaleString()}
                      </TableCell>
                      <TableCell align="right">{r.be.toLocaleString()}</TableCell>
                      <TableCell align="right">{fmt(r.winpct, 2)}%</TableCell>
                      <TableCell align="right">{fmt(r.avgr, 3)}</TableCell>
                      <TableCell align="right">{fmt(r.avgpct, 3)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          <Paper sx={{ mb: 2 }}>
            <Box sx={{ px: 2, pt: 2, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1e3a8a', flex: '1 1 200px' }}>
                Trade ledger (entry day → exit day)
              </Typography>
              <TextField
                select
                size="small"
                label="Algo"
                value={ledgerAlgo}
                onChange={(e) => {
                  setLedgerAlgo(e.target.value);
                  setLedgerPage(0);
                }}
                sx={{ minWidth: 140 }}
              >
                <MenuItem value="ALL">All</MenuItem>
                {ALGOS.map((a) => (
                  <MenuItem key={a} value={a}>
                    {a}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                size="small"
                label="Sort ledger"
                value={ledgerSort}
                onChange={(e) => {
                  setLedgerSort(e.target.value);
                  setLedgerPage(0);
                }}
                sx={{ minWidth: 220 }}
              >
                <MenuItem value="entry-desc">Entry date (newest)</MenuItem>
                <MenuItem value="entry-asc">Entry date (oldest)</MenuItem>
                <MenuItem value="exit-desc">Exit date (newest)</MenuItem>
                <MenuItem value="exit-asc">Exit date (oldest)</MenuItem>
              </TextField>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ px: 2, display: 'block', pb: 1 }}>
              Entry date = <strong>EntryDate</strong> column (trade open). Exit date = <strong>ExitDate</strong> from the
              verifier; re-export if missing.
            </Typography>
            <TableContainer sx={{ maxHeight: 480 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Entry date</TableCell>
                    <TableCell>Exit date</TableCell>
                    <TableCell>Side</TableCell>
                    <TableCell>Algo</TableCell>
                    <TableCell>Stock</TableCell>
                    <TableCell align="right">Entry</TableCell>
                    <TableCell align="right">Exit</TableCell>
                    <TableCell align="right">SL</TableCell>
                    <TableCell>Win/Loss</TableCell>
                    <TableCell align="right">R</TableCell>
                    <TableCell align="right">% Gain</TableCell>
                    <TableCell>Notes</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pagedLedger.map((row, idx) => (
                    <TableRow key={`${row._entryDate}-${row.Stock}-${row.Algo}-${idx}`} hover>
                      <TableCell>{row._entryDate || '—'}</TableCell>
                      <TableCell>{row._exitDate || '—'}</TableCell>
                      <TableCell>{row._side || '—'}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{row.Algo}</TableCell>
                      <TableCell>{row.Stock}</TableCell>
                      <TableCell align="right">{fmt(row.Entry, 4)}</TableCell>
                      <TableCell align="right">{fmt(row.Exit, 4)}</TableCell>
                      <TableCell align="right">{fmt(row.SL, 4)}</TableCell>
                      <TableCell>{row['Win/Loss']}</TableCell>
                      <TableCell align="right">{fmt(row['R:R Actual'], 3)}</TableCell>
                      <TableCell align="right">{fmt(row['% Gain'], 3)}%</TableCell>
                      <TableCell sx={{ maxWidth: 180 }}>{row.Notes}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={ledgerRows.length}
              page={ledgerPage}
              onPageChange={(_, p) => setLedgerPage(p)}
              rowsPerPage={ledgerRowsPerPage}
              onRowsPerPageChange={(e) => {
                setLedgerRowsPerPage(parseInt(e.target.value, 10));
                setLedgerPage(0);
              }}
              rowsPerPageOptions={[25, 50, 100, 200]}
            />
          </Paper>

          <Paper>
            <Box sx={{ px: 2, pt: 2, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1e3a8a', flex: '1 1 auto' }}>
                Per ticker (trades & each algo)
              </Typography>
              <TextField
                size="small"
                label="Filter symbol"
                value={tickerFilter}
                onChange={(e) => {
                  setTickerFilter(e.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: 200 }}
              />
              <TextField
                select
                size="small"
                label="Sort"
                value={sortMode}
                onChange={(e) => {
                  setSortMode(e.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: 220 }}
              >
                <MenuItem value="trades-desc">Trades (high → low)</MenuItem>
                <MenuItem value="trades-asc">Trades (low → high)</MenuItem>
                <MenuItem value="sym-asc">Symbol A–Z</MenuItem>
                <MenuItem value="winpct-desc">Win % (high → low)</MenuItem>
                <MenuItem value="avgr-desc">Avg R (high → low)</MenuItem>
              </TextField>
            </Box>
            <TableContainer sx={{ maxHeight: 560 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Symbol</TableCell>
                    <TableCell align="right">Trades</TableCell>
                    <TableCell align="right">Wins</TableCell>
                    <TableCell align="right">Loss</TableCell>
                    <TableCell align="right">BE</TableCell>
                    <TableCell align="right">Win %</TableCell>
                    <TableCell align="right">Avg R</TableCell>
                    {ALGOS.map((a) => (
                      <TableCell key={a} align="right" title="Count (win % within that algo for this ticker)">
                        {a}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pagedTickers.map((r) => (
                    <TableRow key={r.sym} hover>
                      <TableCell sx={{ fontWeight: 700 }}>{r.sym}</TableCell>
                      <TableCell align="right">{r.trades.toLocaleString()}</TableCell>
                      <TableCell align="right" sx={{ color: '#15803d' }}>
                        {r.wins.toLocaleString()}
                      </TableCell>
                      <TableCell align="right" sx={{ color: '#b91c1c' }}>
                        {r.losses.toLocaleString()}
                      </TableCell>
                      <TableCell align="right">{r.be.toLocaleString()}</TableCell>
                      <TableCell align="right">{fmt(r.winpct, 2)}%</TableCell>
                      <TableCell align="right">{fmt(r.avgr, 3)}</TableCell>
                      {r.algoCells.map((c, idx) => (
                        <TableCell key={ALGOS[idx]} align="right">
                          {c}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={tickerRows.length}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              rowsPerPageOptions={[10, 25, 50, 100]}
            />
          </Paper>
            </>
          ) : null}
        </>
      )}
    </Box>
  );
}

export default AlgoPerformancePage;
