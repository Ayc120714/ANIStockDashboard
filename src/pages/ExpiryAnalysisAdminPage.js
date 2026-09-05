import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Slider,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableSortLabel,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
  Bar,
  BarChart,
  Legend,
} from 'recharts';
import { MdRefresh } from 'react-icons/md';
import {
  fetchExpiryAnalysis,
  fetchExpirySymbols,
  fetchExpiryUniverse,
  fetchExpiryWeekNews,
  generateExpiryCatalyst,
  rebuildExpiryUniverse,
  refreshExpiryAnalysis,
} from '../api/expiryAnalysis';
import { parseScreenDateString } from '../utils/screenDatePickerBounds';
import {
  INDEX_ANALYSIS_SYMBOLS,
  OUTLIER_FILTERS,
  OUTLIER_FILTER_LABELS,
  UNIVERSE_SORT_KEYS,
  UNIVERSE_SORT_LABELS,
  coarseBinColor,
  defaultNewsKeywords,
  filterAndSortUniverseRows,
  formatOcPct,
  isDateInSetupWeek,
  isoDateFromLocal,
  nextUniverseSort,
  outlierPointColor,
  setupWeekForDate,
  setupWeekSelectLabel,
  weeksWithSetupCounts,
} from '../utils/expiryAnalysisDisplay';

const TAB_IDS = ['universe', 'returns', 'greenRed', 'streaks', 'outliers', 'pattern', 'ml'];

const darkPaper = {
  bgcolor: '#111827',
  color: '#e5e7eb',
  border: '1px solid #1f2937',
};

function HeaderMeta({ meta }) {
  if (!meta) return null;
  return (
    <Typography variant="body2" sx={{ color: '#9ca3af', mb: 2 }}>
      Analyzed {meta.period_count || 0} weekly periods for {meta.display_name || meta.symbol_key || 'symbol'}
      {meta.kind ? ` (${meta.kind})` : ''}
      {meta.from_date ? ` from ${meta.from_date} to ${meta.to_date}` : ''}. Calculation Type:{' '}
      {meta.calculation_type || 'OC'} (Open+Close). Spot {meta.spot != null ? Number(meta.spot).toFixed(2) : '—'}.
    </Typography>
  );
}

function ReturnsTable({ rows }) {
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell sx={{ color: '#9ca3af' }}>Return Range</TableCell>
          <TableCell sx={{ color: '#9ca3af' }} align="right">Number of Periods</TableCell>
          <TableCell sx={{ color: '#9ca3af' }} align="right">% of Total</TableCell>
          <TableCell sx={{ color: '#9ca3af' }}>Percentile Range</TableCell>
          <TableCell sx={{ color: '#9ca3af' }}>Probability</TableCell>
          <TableCell sx={{ color: '#9ca3af' }}>Price Range</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {(rows || []).map((row) => (
          <TableRow key={row.label}>
            <TableCell sx={{ color: coarseBinColor(row.lo, row.hi), fontWeight: 700 }}>{row.label}</TableCell>
            <TableCell align="right">{row.count}</TableCell>
            <TableCell align="right">{Number(row.pct_of_total).toFixed(1)}%</TableCell>
            <TableCell>{row.percentile_range}</TableCell>
            <TableCell>{row.probability}</TableCell>
            <TableCell>{row.price_range}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function DistTable({ title, subtitle, rows, accent, highlightLabel }) {
  return (
    <Paper sx={{ ...darkPaper, p: 2, flex: 1, minWidth: 0 }}>
      <Typography variant="h6" sx={{ color: accent, fontWeight: 800 }}>{title}</Typography>
      <Typography variant="caption" sx={{ color: '#9ca3af' }}>{subtitle}</Typography>
      <Table size="small" sx={{ mt: 1 }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ color: '#9ca3af' }}>#</TableCell>
            <TableCell sx={{ color: '#9ca3af' }}>Return Range</TableCell>
            <TableCell sx={{ color: '#9ca3af' }} align="right">Count</TableCell>
            <TableCell sx={{ color: '#9ca3af' }} align="right">Probability %</TableCell>
            <TableCell sx={{ color: '#9ca3af' }} align="right">Cumulative %</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {(rows || []).slice(0, 40).map((row) => {
            const highlighted = Boolean(highlightLabel) && row.label === highlightLabel;
            return (
              <TableRow
                key={`${row.label}-${row.index}`}
                selected={highlighted}
                sx={highlighted ? { bgcolor: 'rgba(59,130,246,0.22)' } : undefined}
              >
                <TableCell>{row.index}</TableCell>
                <TableCell sx={{ color: accent }}>{row.label}</TableCell>
                <TableCell align="right">{row.count}</TableCell>
                <TableCell align="right">{Number(row.probability_pct).toFixed(2)}%</TableCell>
                <TableCell align="right">{Number(row.cumulative_pct).toFixed(2)}%</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Paper>
  );
}

const darkSelectSx = {
  color: '#e5e7eb',
  '.MuiOutlinedInput-notchedOutline': { borderColor: '#4b5563' },
  '.MuiSvgIcon-root': { color: '#9ca3af' },
};

const darkToggleSx = {
  color: '#9ca3af',
  borderColor: '#4b5563',
  '&.Mui-selected': { color: '#fff', bgcolor: '#1d4ed8' },
  '&.Mui-selected:hover': { bgcolor: '#1e40af' },
};

function ExpiryAnalysisAdminPage() {
  const [tab, setTab] = useState(0);
  const [symbol, setSymbol] = useState('NIFTY');
  const [symbolOptions, setSymbolOptions] = useState(INDEX_ANALYSIS_SYMBOLS);
  const [symbolInput, setSymbolInput] = useState('');
  const [universeRows, setUniverseRows] = useState([]);
  const [universeJob, setUniverseJob] = useState(null);
  const [coverage, setCoverage] = useState(89);
  const [k, setK] = useState(5);
  const [patternLength, setPatternLength] = useState(4);
  const [vixScale, setVixScale] = useState(true);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [outlierFilter, setOutlierFilter] = useState('all');
  const [universeSortKey, setUniverseSortKey] = useState('ml_setup_count');
  const [universeSortDir, setUniverseSortDir] = useState('desc');
  const [setupWeekStart, setSetupWeekStart] = useState('');
  const [keywords, setKeywords] = useState(defaultNewsKeywords(1, 'NIFTY'));
  const [headlines, setHeadlines] = useState([]);
  const [newsStatus, setNewsStatus] = useState('');
  const [catalyst, setCatalyst] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async ({ refresh = false } = {}) => {
    setLoading(true);
    setError('');
    try {
      const fn = refresh ? refreshExpiryAnalysis : fetchExpiryAnalysis;
      const res = await fn({
        symbol,
        coverage,
        k,
        pattern_length: patternLength,
        vix_scale: vixScale ? 'true' : 'false',
      });
      setPayload(res?.data || res);
    } catch (err) {
      setError(String(err?.message || err || 'Failed to load expiry analysis'));
    } finally {
      setLoading(false);
    }
  }, [symbol, coverage, k, patternLength, vixScale]);

  const loadUniverse = useCallback(async () => {
    try {
      const res = await fetchExpiryUniverse();
      setUniverseRows(res?.data || []);
      setUniverseJob(res?.job || null);
    } catch (_) {
      setUniverseRows([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadUniverse();
  }, [loadUniverse]);

  useEffect(() => {
    if (!universeJob?.running) return undefined;
    const id = setInterval(() => {
      loadUniverse();
    }, 4000);
    return () => clearInterval(id);
  }, [universeJob?.running, loadUniverse]);

  useEffect(() => {
    const q = String(symbolInput || '').trim();
    if (q.length < 1) {
      setSymbolOptions(INDEX_ANALYSIS_SYMBOLS);
      return undefined;
    }
    let cancelled = false;
    fetchExpirySymbols({ q, limit: 50 })
      .then((res) => {
        if (!cancelled) setSymbolOptions(res?.data || INDEX_ANALYSIS_SYMBOLS);
      })
      .catch(() => {
        if (!cancelled) setSymbolOptions(INDEX_ANALYSIS_SYMBOLS);
      });
    return () => {
      cancelled = true;
    };
  }, [symbolInput]);

  const meta = payload?.meta;
  const outliers = payload?.outliers;
  const scatter = useMemo(
    () =>
      (outliers?.points || []).map((p, i) => ({
        i,
        x: i,
        y: Number(p.oc_return),
        kind: p.kind,
        week_start: p.week_start,
        fill: outlierPointColor(p.kind),
      })),
    [outliers],
  );

  const visibleUniverseRows = useMemo(
    () => filterAndSortUniverseRows(universeRows, {
      outlier: outlierFilter,
      sortKey: universeSortKey,
      sortDir: universeSortDir,
    }),
    [universeRows, outlierFilter, universeSortKey, universeSortDir],
  );

  const setupWeeks = useMemo(() => weeksWithSetupCounts(payload?.weeks), [payload]);
  const selectedSetupWeek = useMemo(
    () => setupWeeks.find((week) => week.week_start === setupWeekStart) || setupWeeks[0] || null,
    [setupWeeks, setupWeekStart],
  );

  useEffect(() => {
    if (!setupWeeks.length) {
      setSetupWeekStart('');
      return;
    }
    if (!setupWeeks.some((week) => week.week_start === setupWeekStart)) {
      setSetupWeekStart(setupWeeks[0].week_start);
    }
  }, [setupWeeks, setupWeekStart]);

  const fetchNews = async (week) => {
    const w = week || selectedWeek;
    if (!w) return;
    setBusy('news');
    setNewsStatus('');
    try {
      const res = await fetchExpiryWeekNews({
        week_start: w.week_start,
        week_end: w.week_end,
        keywords,
        symbol,
        oc_return: w.oc_return,
      });
      setHeadlines(res?.headlines || []);
      setNewsStatus(`Found ${(res?.headlines || []).length} headlines for week of ${w.week_start} to ${w.week_end}.`);
    } catch (err) {
      setNewsStatus(String(err?.message || err || 'News lookup failed'));
    } finally {
      setBusy('');
    }
  };

  const runCatalyst = async () => {
    if (!selectedWeek) return;
    setBusy('catalyst');
    try {
      const res = await generateExpiryCatalyst({
        week_start: selectedWeek.week_start,
        week_end: selectedWeek.week_end,
        oc_return: selectedWeek.oc_return,
        keywords,
        headlines: headlines.map((h) => h.title),
      });
      setCatalyst(res?.summary || '');
    } catch (err) {
      setCatalyst(String(err?.message || err || 'Summary failed'));
    } finally {
      setBusy('');
    }
  };

  const pickWeek = (week) => {
    setSelectedWeek(week);
    setKeywords(defaultNewsKeywords(week?.oc_return, symbol));
    setHeadlines([]);
    setCatalyst('');
    setNewsStatus('');
  };

  const handleUniverseSort = (key) => {
    const next = nextUniverseSort(universeSortKey, universeSortDir, key);
    setUniverseSortKey(next.sortKey);
    setUniverseSortDir(next.sortDir);
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
    <Box sx={{ bgcolor: '#0b1220', color: '#e5e7eb', minHeight: '100%', p: { xs: 1.5, md: 2 }, borderRadius: 2 }}>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5 }}>
        Expiry Analysis Advanced
      </Typography>
      <Typography variant="body2" sx={{ color: '#9ca3af', mb: 2 }}>
        Admin only. Weekly OC for Nifty 50, Nifty Bank, and every stock in the universe. Pick a symbol or rebuild the full universe.
      </Typography>

      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
        {INDEX_ANALYSIS_SYMBOLS.map((item) => (
          <Chip
            key={item.symbol}
            label={item.display_name}
            clickable
            color={symbol === item.symbol ? 'primary' : 'default'}
            onClick={() => setSymbol(item.symbol)}
          />
        ))}
        <Autocomplete
          sx={{ minWidth: 260 }}
          size="small"
          options={symbolOptions}
          getOptionLabel={(opt) => opt?.display_name || opt?.symbol || ''}
          filterOptions={(opts) => opts}
          inputValue={symbolInput}
          onInputChange={(_, value) => setSymbolInput(value)}
          onChange={(_, value) => {
            if (value?.symbol) setSymbol(value.symbol);
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Search stocks"
              placeholder="Type a ticker"
              sx={{ input: { color: '#e5e7eb' }, label: { color: '#9ca3af' } }}
            />
          )}
        />
        <Chip size="small" label={meta?.display_name || symbol} />
        <Button
          variant="contained"
          startIcon={<MdRefresh />}
          onClick={() => load({ refresh: true })}
          disabled={loading}
          sx={{ bgcolor: '#dc2626', '&:hover': { bgcolor: '#b91c1c' } }}
        >
          Rebuild this symbol
        </Button>
        <Button
          variant="outlined"
          disabled={Boolean(universeJob?.running)}
          onClick={async () => {
            const res = await rebuildExpiryUniverse();
            setUniverseJob(res?.job || { running: true });
          }}
          sx={{ color: '#e5e7eb', borderColor: '#4b5563' }}
        >
          {universeJob?.running ? 'Universe rebuild running…' : 'Rebuild all stocks'}
        </Button>
        <Chip size="small" label={loading ? 'Loading…' : `Generated ${meta?.generated_at || '—'}`} />
      </Box>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      <HeaderMeta meta={meta} />

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 2, '.MuiTab-root': { color: '#9ca3af' }, '.Mui-selected': { color: '#60a5fa' } }}
      >
        <Tab label="Universe" />
        <Tab label="Returns Analysis" />
        <Tab label="Green vs Red" />
        <Tab label="Streaks" />
        <Tab label="Outliers & News" />
        <Tab label="MASS Pattern" />
        <Tab label="ML Setups" />
      </Tabs>

      {TAB_IDS[tab] === 'universe' ? (
        <Paper sx={{ ...darkPaper, p: 2, overflow: 'auto' }}>
          <Typography variant="h6">This week across Nifty, Bank Nifty, and all stocks</Typography>
          <Typography variant="body2" sx={{ color: '#9ca3af', mb: 1 }}>
            {visibleUniverseRows.length} of {universeRows.length} symbols
            {outlierFilter !== 'all' ? ` · ${OUTLIER_FILTER_LABELS[outlierFilter] || outlierFilter}` : ''}
            {universeJob?.running ? ' · rebuild in progress' : ''}
            {universeJob?.finished_at ? ` · last job ok ${universeJob.ok || 0} / failed ${universeJob.failed || 0}` : ''}.
            Click a row to open the full OC analysis.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
            <Typography variant="body2" sx={{ color: '#9ca3af' }}>Outlier</Typography>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={outlierFilter}
              onChange={(_, value) => {
                if (value) setOutlierFilter(value);
              }}
            >
              {OUTLIER_FILTERS.map((value) => (
                <ToggleButton key={value} value={value} sx={darkToggleSx}>
                  {OUTLIER_FILTER_LABELS[value]}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel sx={{ color: '#9ca3af' }}>Sort by</InputLabel>
              <Select
                label="Sort by"
                value={universeSortKey}
                onChange={(e) => setUniverseSortKey(e.target.value)}
                sx={darkSelectSx}
              >
                {UNIVERSE_SORT_KEYS.map((key) => (
                  <MenuItem key={key} value={key}>{UNIVERSE_SORT_LABELS[key]}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={universeSortDir}
              onChange={(_, value) => {
                if (value) setUniverseSortDir(value);
              }}
            >
              <ToggleButton value="desc" sx={darkToggleSx}>Descending</ToggleButton>
              <ToggleButton value="asc" sx={darkToggleSx}>Ascending</ToggleButton>
            </ToggleButtonGroup>
          </Box>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: '#9ca3af' }}>
                  <TableSortLabel
                    active={universeSortKey === 'symbol'}
                    direction={universeSortKey === 'symbol' ? universeSortDir : 'asc'}
                    onClick={() => handleUniverseSort('symbol')}
                    sx={{ color: '#9ca3af' }}
                  >
                    Symbol
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ color: '#9ca3af' }}>Kind</TableCell>
                <TableCell sx={{ color: '#9ca3af' }} align="right">
                  <TableSortLabel
                    active={universeSortKey === 'oc_return'}
                    direction={universeSortKey === 'oc_return' ? universeSortDir : 'desc'}
                    onClick={() => handleUniverseSort('oc_return')}
                    sx={{ color: '#9ca3af' }}
                  >
                    This week OC
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ color: '#9ca3af' }}>
                  <TableSortLabel
                    active={universeSortKey === 'outlier'}
                    direction={universeSortKey === 'outlier' ? universeSortDir : 'asc'}
                    onClick={() => handleUniverseSort('outlier')}
                    sx={{ color: '#9ca3af' }}
                  >
                    Outlier
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ color: '#9ca3af' }} align="right">
                  <TableSortLabel
                    active={universeSortKey === 'ml_setup_count'}
                    direction={universeSortKey === 'ml_setup_count' ? universeSortDir : 'desc'}
                    onClick={() => handleUniverseSort('ml_setup_count')}
                    sx={{ color: '#9ca3af' }}
                  >
                    ML setups
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ color: '#9ca3af' }} align="right">
                  <TableSortLabel
                    active={universeSortKey === 'period_count'}
                    direction={universeSortKey === 'period_count' ? universeSortDir : 'desc'}
                    onClick={() => handleUniverseSort('period_count')}
                    sx={{ color: '#9ca3af' }}
                  >
                    Weeks
                  </TableSortLabel>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleUniverseRows.map((row) => (
                <TableRow
                  key={`${row.kind}-${row.symbol}`}
                  hover
                  selected={symbol === row.symbol}
                  onClick={() => setSymbol(row.symbol)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell>{row.display_name || row.symbol}</TableCell>
                  <TableCell>{row.kind}</TableCell>
                  <TableCell align="right">{formatOcPct(row.oc_return)}</TableCell>
                  <TableCell sx={{ color: outlierPointColor(row.outlier_kind) }}>{row.outlier_kind}</TableCell>
                  <TableCell align="right">{row.ml_setup_count || 0}</TableCell>
                  <TableCell align="right">{row.period_count || 0}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!visibleUniverseRows.length ? (
            <Typography variant="body2" sx={{ color: '#9ca3af', mt: 2 }}>
              {universeRows.length
                ? `No ${OUTLIER_FILTER_LABELS[outlierFilter] || outlierFilter} rows in this week's snapshot.`
                : 'No universe snapshot yet. Use Rebuild all stocks (Sunday job also fills this).'}
            </Typography>
          ) : null}
        </Paper>
      ) : null}

      {TAB_IDS[tab] === 'returns' ? (
        <Paper sx={{ ...darkPaper, p: 2, overflow: 'auto' }}>
          <ReturnsTable rows={payload?.coarse_bins} />
        </Paper>
      ) : null}

      {TAB_IDS[tab] === 'greenRed' ? (
        <Box>
          <Paper sx={{ ...darkPaper, p: 2, mb: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
              Date with ML setup count
            </Typography>
            <Typography variant="body2" sx={{ color: '#9ca3af', mb: 1.5 }}>
              Only weeks where high-conviction setups fired are selectable. The matching green or red return bin is highlighted below.
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <DatePicker
                label="Week with setups"
                value={parseScreenDateString(selectedSetupWeek?.week_start || '')}
                onChange={(date) => {
                  const week = setupWeekForDate(setupWeeks, isoDateFromLocal(date));
                  if (week?.week_start) setSetupWeekStart(week.week_start);
                }}
                shouldDisableDate={(date) => !isDateInSetupWeek(setupWeeks, isoDateFromLocal(date))}
                minDate={parseScreenDateString(setupWeeks[setupWeeks.length - 1]?.week_start || '')}
                maxDate={parseScreenDateString(setupWeeks[0]?.week_end || setupWeeks[0]?.week_start || '')}
                slotProps={{
                  textField: {
                    size: 'small',
                    helperText: setupWeeks.length
                      ? `${setupWeeks.length} weeks have a setup count`
                      : 'No weeks with ML setups yet',
                    sx: {
                      minWidth: 220,
                      input: { color: '#e5e7eb' },
                      label: { color: '#9ca3af' },
                      '.MuiFormHelperText-root': { color: '#9ca3af' },
                    },
                  },
                }}
              />
              <Autocomplete
                sx={{ minWidth: 360, flex: 1 }}
                size="small"
                options={setupWeeks}
                getOptionLabel={(opt) => setupWeekSelectLabel(opt)}
                isOptionEqualToValue={(a, b) => a?.week_start === b?.week_start}
                value={selectedSetupWeek}
                onChange={(_, value) => {
                  if (value?.week_start) setSetupWeekStart(value.week_start);
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Week with a setup count"
                    sx={{ input: { color: '#e5e7eb' }, label: { color: '#9ca3af' } }}
                  />
                )}
              />
            </Box>
            {selectedSetupWeek ? (
              <Box sx={{ mt: 1.5 }}>
                <Chip
                  size="small"
                  label={setupWeekSelectLabel(selectedSetupWeek)}
                  sx={{
                    mr: 1,
                    mb: 1,
                    bgcolor: selectedSetupWeek.side === 'red' ? '#7f1d1d' : '#14532d',
                    color: '#e5e7eb',
                  }}
                />
                {selectedSetupWeek.range_label ? (
                  <Chip size="small" label={`Bin ${selectedSetupWeek.range_label}`} sx={{ mb: 1, color: '#e5e7eb' }} />
                ) : null}
                {(selectedSetupWeek.setups || []).length ? (
                  <Table size="small" sx={{ mt: 1, maxWidth: 720 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ color: '#9ca3af' }}>Symbol</TableCell>
                        <TableCell sx={{ color: '#9ca3af' }}>Alert</TableCell>
                        <TableCell sx={{ color: '#9ca3af' }} align="right">ML score</TableCell>
                        <TableCell sx={{ color: '#9ca3af' }}>Session</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedSetupWeek.setups.slice(0, 12).map((row) => (
                        <TableRow key={`${row.symbol}-${row.alert_type}-${row.session_date}`}>
                          <TableCell>{row.symbol}</TableCell>
                          <TableCell>{row.alert_type}</TableCell>
                          <TableCell align="right">{row.ml_score != null ? Number(row.ml_score).toFixed(2) : '—'}</TableCell>
                          <TableCell>{row.session_date}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : null}
              </Box>
            ) : (
              <Typography variant="body2" sx={{ color: '#9ca3af', mt: 1 }}>
                Rebuild this symbol after the ML ranker has run to attach setup counts to weekly expiries.
              </Typography>
            )}
          </Paper>
          <Paper sx={{ ...darkPaper, p: 2, mb: 2, height: 360 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              Probability Distribution: Green vs Red Expiries (Non-Zero Only)
            </Typography>
            <ResponsiveContainer width="100%" height="90%">
              <BarChart data={payload?.green_red?.chart || []}>
                <CartesianGrid stroke="#1f2937" />
                <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 10 }} interval={2} angle={-40} height={70} />
                <YAxis tick={{ fill: '#9ca3af' }} label={{ value: 'Probability %', angle: -90, fill: '#9ca3af' }} />
                <RTooltip />
                <Legend />
                <Bar dataKey="green" fill="#22c55e" name="Green" />
                <Bar dataKey="red" fill="#ef4444" name="Red" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <DistTable
              title="Green Expiry Distribution"
              subtitle={`Based on ${payload?.green_red?.green_count || 0} green expiries`}
              rows={payload?.green_red?.green}
              accent="#22c55e"
              highlightLabel={selectedSetupWeek?.side === 'green' ? selectedSetupWeek.range_label : null}
            />
            <DistTable
              title="Red Expiry Distribution"
              subtitle={`Based on ${payload?.green_red?.red_count || 0} red expiries`}
              rows={payload?.green_red?.red}
              accent="#ef4444"
              highlightLabel={selectedSetupWeek?.side === 'red' ? selectedSetupWeek.range_label : null}
            />
          </Box>
        </Box>
      ) : null}

      {TAB_IDS[tab] === 'streaks' ? (
        <Paper sx={{ ...darkPaper, p: 2 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>Streak State Analysis</Typography>
          <Table size="small" sx={{ mb: 2, maxWidth: 420 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: '#9ca3af' }}>Streak State</TableCell>
                <TableCell sx={{ color: '#9ca3af' }} align="right">Long-term Probability</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(payload?.streaks?.long_term || []).map((row) => (
                <TableRow key={row.state}>
                  <TableCell>{row.state}</TableCell>
                  <TableCell align="right">{Number(row.probability_pct).toFixed(1)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Key Insights</Typography>
          {(payload?.streaks?.transitions || []).map((row) => (
            <Typography key={`${row.from_state}-${row.to_state}`} variant="body2" sx={{ color: '#d1d5db', my: 0.4 }}>
              From {row.from_state}: {Number(row.probability_pct).toFixed(1)}% chance of becoming {row.to_state}
            </Typography>
          ))}
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mt: 2 }}>Streak Persistence Analysis</Typography>
          <Typography variant="body2">
            Positive Streak Persistence: {payload?.streaks?.positive_persistence_pct ?? 0}% chance of continuing positive streaks
          </Typography>
          <Typography variant="body2">
            Negative Streak Persistence: {payload?.streaks?.negative_persistence_pct ?? 0}% chance of continuing negative streaks
          </Typography>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mt: 2 }}>Streak Length Patterns</Typography>
          <Typography variant="body2">
            Short to Long Streaks: {payload?.streaks?.short_to_long_pct ?? 0}% chance of short streaks becoming longer
          </Typography>
        </Paper>
      ) : null}

      {TAB_IDS[tab] === 'outliers' ? (
        <Box>
          <Paper sx={{ ...darkPaper, p: 2, mb: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Probability Boundary Coverage (%) — {coverage}
            </Typography>
            <Slider
              min={50}
              max={99}
              value={coverage}
              onChange={(_, v) => setCoverage(v)}
              sx={{ color: '#ef4444', maxWidth: 480 }}
            />
            <Typography variant="body2" sx={{ color: '#9ca3af' }}>
              {coverage}% coverage uses the {outliers?.lower_percentile}th to {outliers?.upper_percentile}th
              percentile across {outliers?.total || 0} weekly OC returns. Lower {outliers?.lower_boundary}% /
              upper {outliers?.upper_boundary}%.
            </Typography>
            <Box sx={{ height: 360, mt: 2 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart>
                  <CartesianGrid stroke="#1f2937" />
                  <XAxis dataKey="x" type="number" tick={{ fill: '#9ca3af' }} name="Expiry" />
                  <YAxis dataKey="y" tick={{ fill: '#9ca3af' }} name="Return %" />
                  <RTooltip formatter={(v) => formatOcPct(v)} />
                  {outliers?.upper_boundary != null ? (
                    <ReferenceLine y={outliers.upper_boundary} stroke="#e5e7eb" strokeDasharray="4 4" />
                  ) : null}
                  {outliers?.lower_boundary != null ? (
                    <ReferenceLine y={outliers.lower_boundary} stroke="#ef4444" strokeDasharray="4 4" />
                  ) : null}
                  <Scatter
                    data={scatter}
                    fill="#6b7280"
                    shape={(props) => {
                      const { cx, cy, payload } = props;
                      return <circle cx={cx} cy={cy} r={4} fill={payload.fill} />;
                    }}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </Box>
            <Box sx={{ display: 'flex', gap: 3, mt: 2, flexWrap: 'wrap' }}>
              <Typography>Total Expiries: {outliers?.total || 0}</Typography>
              <Typography>Total Outliers: {outliers?.outlier_count || 0} ({outliers?.outlier_pct || 0}%)</Typography>
              <Typography sx={{ color: '#ef4444' }}>Downside: {outliers?.downside_count || 0}</Typography>
              <Typography sx={{ color: '#22c55e' }}>Upside: {outliers?.upside_count || 0}</Typography>
            </Box>
          </Paper>
          <Paper sx={{ ...darkPaper, p: 2, mb: 2 }}>
            <Typography variant="h6">Outlier Expiries Table</Typography>
            <Typography variant="body2" sx={{ color: '#9ca3af', mb: 1 }}>
              Weekly expiries outside the boundary, sorted by absolute size. Select a week to fetch headlines.
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: '#9ca3af' }}>Week</TableCell>
                  <TableCell sx={{ color: '#9ca3af' }}>Kind</TableCell>
                  <TableCell sx={{ color: '#9ca3af' }} align="right">OC Return</TableCell>
                  <TableCell sx={{ color: '#9ca3af' }} align="right">ML setups</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(outliers?.table || []).map((row) => (
                  <TableRow
                    key={row.week_start}
                    hover
                    selected={selectedWeek?.week_start === row.week_start}
                    onClick={() => pickWeek(row)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>{row.week_start} → {row.week_end}</TableCell>
                    <TableCell sx={{ color: outlierPointColor(row.kind) }}>{row.kind}</TableCell>
                    <TableCell align="right">{formatOcPct(row.oc_return)}</TableCell>
                    <TableCell align="right">{row.ml_setup_count || 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
          <Paper sx={{ ...darkPaper, p: 2 }}>
            <Typography variant="h6">Historical Global News & Events</Typography>
            <Typography variant="body2" sx={{ color: '#9ca3af', mb: 1 }}>
              Select an outlier week, then fetch Google News RSS and generate an LLM causal summary.
            </Typography>
            <TextField
              size="small"
              fullWidth
              label="Search keywords"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              sx={{ mb: 1, input: { color: '#e5e7eb' }, label: { color: '#9ca3af' } }}
            />
            <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                disabled={!selectedWeek || busy === 'news'}
                onClick={() => fetchNews()}
                sx={{ bgcolor: '#dc2626' }}
              >
                Fetch News Headlines
              </Button>
              <Button
                variant="outlined"
                disabled={!headlines.length || busy === 'catalyst'}
                onClick={runCatalyst}
                sx={{ color: '#e5e7eb', borderColor: '#4b5563' }}
              >
                Generate Causal Catalyst Summary
              </Button>
            </Box>
            {newsStatus ? <Alert severity="success" sx={{ mb: 1 }}>{newsStatus}</Alert> : null}
            {(headlines || []).map((h) => (
              <Typography key={h.link || h.title} variant="body2" sx={{ mb: 0.6 }}>
                {h.title} — {h.source || 'source'} {h.published ? `(${h.published})` : ''}
              </Typography>
            ))}
            {catalyst ? (
              <Paper sx={{ bgcolor: '#030712', p: 2, mt: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>LLM Analysis</Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{catalyst}</Typography>
              </Paper>
            ) : null}
          </Paper>
        </Box>
      ) : null}

      {TAB_IDS[tab] === 'pattern' ? (
        <Paper sx={{ ...darkPaper, p: 2 }}>
          <Typography variant="h6">MASS Similarity Configurations</Typography>
          <Typography variant="body2" sx={{ color: '#9ca3af', mb: 2 }}>
            Daily pattern for weekly expiry. Overlay the current Nifty OC shape against the closest historical windows.
          </Typography>
          <Typography gutterBottom>Number of Matches (K): {k}</Typography>
          <Slider min={1} max={8} value={k} onChange={(_, v) => setK(v)} sx={{ maxWidth: 360, color: '#60a5fa' }} />
          <Typography gutterBottom>Query Pattern Length (Days): {patternLength}</Typography>
          <Slider min={2} max={8} value={patternLength} onChange={(_, v) => setPatternLength(v)} sx={{ maxWidth: 360, color: '#60a5fa' }} />
          <FormControlLabel
            control={<Switch checked={vixScale} onChange={(e) => setVixScale(e.target.checked)} />}
            label="Apply VIX Volatility Scaling"
          />
          <Box sx={{ height: 360, mt: 2 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={payload?.pattern_match?.overlay || []}>
                <CartesianGrid stroke="#1f2937" />
                <XAxis dataKey="day" tick={{ fill: '#9ca3af' }} label={{ value: 'Relative Trading Days', fill: '#9ca3af', position: 'insideBottom', offset: -4 }} />
                <YAxis tick={{ fill: '#9ca3af' }} label={{ value: 'Normalized Return (%)', angle: -90, fill: '#9ca3af' }} />
                <RTooltip />
                <Legend />
                <Line type="monotone" dataKey="current" stroke="#60a5fa" strokeWidth={3} name="Current pattern" dot={false} />
                {(payload?.pattern_match?.matches || []).map((m) => (
                  <Line
                    key={m.rank}
                    type="monotone"
                    dataKey={`match_${m.rank}`}
                    stroke="#9ca3af"
                    strokeDasharray="4 4"
                    name={m.start_date}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </Paper>
      ) : null}

      {TAB_IDS[tab] === 'ml' ? (
        <Paper sx={{ ...darkPaper, p: 2 }}>
          <Typography variant="h6">Machine Learning Setups vs this week</Typography>
          <Typography variant="body2" sx={{ color: '#9ca3af', mb: 2 }}>
            High-conviction setups (score ≥ 0.70) that fired during the latest ISO week, stamped onto the weekly OC expiry.
            Current week {payload?.ml_week?.week_start || '—'} {formatOcPct(payload?.ml_week?.oc_return)} ·{' '}
            {payload?.ml_week?.count || 0} setups (showing top {(payload?.ml_week?.setups || []).length}).
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: '#9ca3af' }}>Symbol</TableCell>
                <TableCell sx={{ color: '#9ca3af' }}>Alert</TableCell>
                <TableCell sx={{ color: '#9ca3af' }} align="right">ML score</TableCell>
                <TableCell sx={{ color: '#9ca3af' }}>Session</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(payload?.ml_week?.setups || []).map((row) => (
                <TableRow key={`${row.symbol}-${row.alert_type}-${row.session_date}`}>
                  <TableCell>{row.symbol}</TableCell>
                  <TableCell>{row.alert_type}</TableCell>
                  <TableCell align="right">{Number(row.ml_score).toFixed(2)}</TableCell>
                  <TableCell>{row.session_date}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!payload?.ml_week?.setups?.length ? (
            <Typography variant="body2" sx={{ color: '#9ca3af', mt: 2 }}>
              No high-conviction ML setups in the current week snapshot yet. Rebuild after the live ML ranker has run.
            </Typography>
          ) : null}
        </Paper>
      ) : null}
    </Box>
    </LocalizationProvider>
  );
}

export default ExpiryAnalysisAdminPage;
