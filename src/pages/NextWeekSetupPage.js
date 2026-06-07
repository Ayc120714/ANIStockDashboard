import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  TextField,
  Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useNavigate } from 'react-router-dom';
import {
  fetchNextWeekMonitorDashboard,
  saveNextWeekMonitorSymbols,
} from '../api/advisor';
import { apiGet } from '../api/apiClient';
import { Table, TableTitle, TableWrapper } from './SectorOutlook.styles';

const POLL_MS = 20000;

function stepColor(step, total) {
  if (step >= total) return '#1b5e20';
  if (step >= total - 1) return '#2e7d32';
  if (step >= 4) return '#f57f17';
  return '#757575';
}

const normalizeSymbol = (value) => String(value || '').trim().toUpperCase();

export default function NextWeekSetupPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [monitorSymbols, setMonitorSymbols] = useState([]);
  const [allSymbols, setAllSymbols] = useState([]);
  const [symbolsLoading, setSymbolsLoading] = useState(true);
  const [selectedStocks, setSelectedStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [lastFetch, setLastFetch] = useState(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const payload = await fetchNextWeekMonitorDashboard();
      setRows(payload?.data ?? []);
      setMonitorSymbols(payload?.symbols ?? []);
      setLastFetch(new Date());
    } catch (e) {
      setError(e?.message || 'Failed to load next-week setup data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    setSymbolsLoading(true);
    apiGet('/watchlist/available-symbols')
      .then((res) => setAllSymbols(res?.data ?? []))
      .catch(() => setAllSymbols([]))
      .finally(() => setSymbolsLoading(false));
  }, []);

  const existingSymbols = useMemo(
    () => new Set(monitorSymbols.map(normalizeSymbol)),
    [monitorSymbols],
  );

  const availableSymbols = useMemo(
    () => allSymbols.filter((s) => !existingSymbols.has(normalizeSymbol(s.symbol))),
    [allSymbols, existingSymbols],
  );

  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) => {
        if (a.trade_ready !== b.trade_ready) return a.trade_ready ? -1 : 1;
        return (b.partial_step || 0) - (a.partial_step || 0);
      }),
    [rows],
  );

  const stepTotal = rows[0]?.step_total || 6;

  const addSelectedStocks = () => {
    const incoming = selectedStocks
      .map((s) => normalizeSymbol(typeof s === 'string' ? s : s?.symbol))
      .filter(Boolean);
    if (!incoming.length) return;
    setMonitorSymbols((prev) => [...new Set([...prev, ...incoming])].sort());
    setSelectedStocks([]);
  };

  const removeSymbol = (sym) => {
    setMonitorSymbols((prev) => prev.filter((s) => s !== sym));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const res = await saveNextWeekMonitorSymbols(monitorSymbols);
      setMessage(
        `Saved ${res.count} symbol(s). WebSocket subscribed to ${res.websocket_subscribed ?? res.count}. Live evaluation started.`,
      );
      await load();
    } catch (e) {
      setError(e?.message || 'Failed to save monitor list.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 1.5, md: 2.5 } }}>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>
        Next Week Setup
      </Typography>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      {message ? <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert> : null}

      <Box
        sx={{
          mb: 2,
          p: 2,
          border: '1px solid #e5e7eb',
          borderRadius: 2,
          bgcolor: '#fafafa',
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
          Your monitor stocks
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
          {monitorSymbols.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No symbols yet — search and pick stocks from the dropdown below.
            </Typography>
          ) : (
            monitorSymbols.map((sym) => (
              <Chip
                key={sym}
                label={sym}
                onDelete={() => removeSymbol(sym)}
                deleteIcon={<DeleteOutlineIcon />}
                size="small"
              />
            ))
          )}
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'flex-start' }}>
          <Autocomplete
            multiple
            size="small"
            options={availableSymbols}
            loading={symbolsLoading}
            getOptionLabel={(opt) =>
              typeof opt === 'string' ? opt : `${opt.symbol} — ${opt.sector || 'N/A'}`
            }
            isOptionEqualToValue={(opt, val) =>
              (opt.symbol || opt) === (val.symbol || val)
            }
            filterOptions={(opts, { inputValue }) => {
              const q = inputValue.trim().toLowerCase();
              if (!q) return opts.slice(0, 200);
              return opts.filter(
                (o) =>
                  o.symbol.toLowerCase().includes(q) ||
                  (o.sector || '').toLowerCase().includes(q) ||
                  (o.subsector || '').toLowerCase().includes(q),
              );
            }}
            value={selectedStocks}
            onChange={(_, newVal) => setSelectedStocks(newVal)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Add symbols"
                placeholder="Search all stocks (symbol, sector)…"
              />
            )}
            renderTags={() => null}
            sx={{ minWidth: 320, flex: 1 }}
            autoHighlight
            disableCloseOnSelect
            ListboxProps={{ style: { maxHeight: 280 } }}
          />
          <Button
            size="small"
            variant="outlined"
            onClick={addSelectedStocks}
            disabled={selectedStocks.length === 0}
            sx={{ height: 40 }}
          >
            {selectedStocks.length > 0 ? `Add (${selectedStocks.length})` : 'Add'}
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={handleSave}
            disabled={saving || monitorSymbols.length === 0}
          >
            {saving ? 'Saving…' : 'Save & subscribe WebSocket'}
          </Button>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 2 }}>
        <Button size="small" variant="outlined" onClick={load} disabled={loading}>
          Refresh
        </Button>
        {lastFetch ? (
          <Typography variant="caption" color="text.secondary">
            Updated {lastFetch.toLocaleTimeString()}
          </Typography>
        ) : null}
      </Box>

      {loading && !rows.length ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
        <TableTitle>Your monitor list ({sorted.length})</TableTitle>
        <TableWrapper>
          <Table>
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Step</th>
                <th>LTP</th>
                <th>Chg %</th>
                <th>Trigger</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 16, color: '#777' }}>
                    Add symbols above and click Save. During market hours the orchestrator WebSocket
                    streams live prices and runs all setup checks every minute.
                  </td>
                </tr>
              ) : (
                sorted.map((r) => (
                  <tr key={r.symbol}>
                    <td style={{ fontWeight: 700 }}>{r.symbol}</td>
                    <td style={{ color: stepColor(r.partial_step, stepTotal), fontWeight: 700 }}>
                      {r.partial_step}/{stepTotal}
                    </td>
                    <td>{r.ltp != null ? Number(r.ltp).toFixed(2) : '—'}</td>
                    <td>{r.change_percent != null ? `${Number(r.change_percent).toFixed(2)}%` : '—'}</td>
                    <td>{r.trigger_date || '—'}</td>
                    <td>
                      {r.trade_ready ? (
                        <Chip size="small" color="success" label="Trade ready" />
                      ) : r.completed ? (
                        <Chip size="small" color="success" label="Complete" />
                      ) : (r.partial_step || 0) >= 4 ? (
                        <Chip size="small" color="warning" label="Near setup" />
                      ) : (
                        <Chip size="small" label="Watching" />
                      )}
                    </td>
                    <td>
                      <Button
                        size="small"
                        variant="contained"
                        disabled={!r.trade_ready}
                        onClick={() =>
                          navigate('/portfolio-manager', {
                            state: { symbol: r.symbol, side: 'BUY' },
                          })
                        }
                      >
                        Trade
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </TableWrapper>
        </>
      )}
    </Box>
  );
}
