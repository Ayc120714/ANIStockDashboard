import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { fetchFiiSectorFlows, fetchFiiSectorStocks } from '../api/fiiDii';
import { SymbolWithTradingView, symbolCellTdStyle } from './TradingViewLink';
import {
  fmtCr,
  nextFiiSectorStockSort,
  normalizeFiiSectorFlowsPayload,
  normalizeFiiSectorStocksPayload,
  sortFiiSectorRows,
  sortFiiSectorStockRows,
} from '../utils/fiiDiiPayload';

const compact = { fontSize: 12, padding: '6px 8px', whiteSpace: 'nowrap' };
const DEFAULT_STOCK_SORT = { key: 'day1d', direction: 'desc' };

function tone(v) {
  if (v == null || !Number.isFinite(Number(v))) return '#666';
  return Number(v) >= 0 ? '#28a745' : '#dc3545';
}

function sortArrow(active, direction) {
  if (!active) return ' ↕';
  return direction === 'asc' ? ' ↑' : ' ↓';
}

export default function FiiSectorFlowsSection() {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState('');
  const [stocksPayload, setStocksPayload] = useState(null);
  const [stocksLoading, setStocksLoading] = useState(false);
  const [stockSort, setStockSort] = useState(DEFAULT_STOCK_SORT);

  const load = useCallback(async ({ refresh = false } = {}) => {
    setLoading(true);
    setError('');
    try {
      const raw = await fetchFiiSectorFlows({ sort: 'fortnight_change', limit: 40, refresh });
      setPayload(normalizeFiiSectorFlowsPayload(raw));
    } catch (e) {
      setError(String(e?.message || 'Could not load FII sector flows'));
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sectors = useMemo(
    () => sortFiiSectorRows(payload?.sectors || [], 'fortnightChange'),
    [payload],
  );

  const sortedStocks = useMemo(
    () => sortFiiSectorStockRows(stocksPayload?.stocks || [], stockSort.key, stockSort.direction),
    [stocksPayload, stockSort],
  );

  const openSector = async (sector) => {
    const name = String(sector || '').trim();
    if (!name) return;
    if (selected === name) {
      setSelected('');
      setStocksPayload(null);
      setStockSort(DEFAULT_STOCK_SORT);
      return;
    }
    setSelected(name);
    setStockSort(DEFAULT_STOCK_SORT);
    setStocksLoading(true);
    try {
      const raw = await fetchFiiSectorStocks(name, { limit: 25 });
      setStocksPayload(normalizeFiiSectorStocksPayload(raw));
    } catch (e) {
      setStocksPayload({
        ok: false,
        sector: name,
        stocks: [],
        count: 0,
        matchedSectors: [],
        message: String(e?.message || 'Could not load stocks'),
      });
    } finally {
      setStocksLoading(false);
    }
  };

  const onStockSort = (column) => {
    setStockSort((prev) => nextFiiSectorStockSort(prev, column));
  };

  const stockHeader = (label, column, align = 'right') => {
    const active = stockSort.key === column;
    return (
      <th
        onClick={() => onStockSort(column)}
        style={{
          ...compact,
          textAlign: align,
          cursor: 'pointer',
          userSelect: 'none',
          color: active ? '#0b3d91' : undefined,
        }}
        title={`Sort by ${label}`}
      >
        {label}
        {sortArrow(active, stockSort.direction)}
      </th>
    );
  };

  return (
    <Box sx={{ mt: 2, mb: 2 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 1 }}>
        <Typography sx={{ fontSize: 15, fontWeight: 700, color: '#0b3d91' }}>
          FII sector additions (fortnightly)
        </Typography>
        {payload?.asOf ? (
          <Typography sx={{ fontSize: 12, color: '#666' }}>as of {payload.asOf}</Typography>
        ) : null}
        <Button size="small" variant="outlined" onClick={() => load({ refresh: true })} sx={{ textTransform: 'none' }}>
          Refresh
        </Button>
      </Box>
      <Typography sx={{ fontSize: 12, color: '#666', mb: 1 }}>
        Screener.in sector flows — click a sector to list matching AYC stocks. Click column headers to sort.
      </Typography>
      {error ? <Typography color="error" sx={{ fontSize: 12, mb: 1 }}>{error}</Typography> : null}
      {payload?.authRequired ? (
        <Typography sx={{ fontSize: 12, color: '#a15c00', mb: 1 }}>
          Screener login required on server (set SCREENER_EMAIL / SCREENER_PASSWORD). {payload.message || ''}
        </Typography>
      ) : null}
      {loading && !sectors.length ? (
        <CircularProgress size={22} />
      ) : (
        <Box sx={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f7f9fc' }}>
                <th style={{ ...compact, textAlign: 'left' }}>Sector</th>
                <th style={{ ...compact, textAlign: 'right' }}>Fortnight Δ</th>
                <th style={{ ...compact, textAlign: 'right' }}>1Y Flow</th>
                <th style={{ ...compact, textAlign: 'right' }}>AUM</th>
              </tr>
            </thead>
            <tbody>
              {sectors.map((row) => (
                <tr
                  key={row.sector}
                  onClick={() => openSector(row.sector)}
                  style={{
                    cursor: 'pointer',
                    background: selected === row.sector ? '#eef5ff' : undefined,
                  }}
                >
                  <td style={compact}>{row.sector}</td>
                  <td style={{ ...compact, textAlign: 'right', color: tone(row.fortnightChange) }}>
                    {row.fortnightChange == null ? '—' : fmtCr(row.fortnightChange)}
                  </td>
                  <td style={{ ...compact, textAlign: 'right', color: tone(row.flow1y) }}>
                    {row.flow1y == null ? '—' : fmtCr(row.flow1y)}
                  </td>
                  <td style={{ ...compact, textAlign: 'right' }}>
                    {row.aum == null ? '—' : Number(row.aum).toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
              {!sectors.length ? (
                <tr>
                  <td colSpan={4} style={{ ...compact, textAlign: 'center', color: '#888' }}>
                    No Screener FII sector rows yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </Box>
      )}

      {selected ? (
        <Box sx={{ mt: 1.5 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 0.5 }}>
            Stocks in {selected}
            {stocksPayload?.matchedSectors?.length
              ? ` · matched ${stocksPayload.matchedSectors.slice(0, 4).join(', ')}`
              : ''}
          </Typography>
          {stocksLoading ? (
            <CircularProgress size={20} />
          ) : (
            <Box sx={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f7f9fc' }}>
                    {stockHeader('Symbol', 'symbol', 'left')}
                    {stockHeader('CMP', 'price')}
                    {stockHeader('CHG%', 'day1d')}
                    {stockHeader('FII %', 'fiiPct')}
                    {stockHeader('FII Δ', 'fiiPctDelta')}
                  </tr>
                </thead>
                <tbody>
                  {sortedStocks.map((row) => (
                    <tr key={row.symbol}>
                      <td style={symbolCellTdStyle(compact)}>
                        <SymbolWithTradingView symbol={row.symbol} />
                      </td>
                      <td style={{ ...compact, textAlign: 'right' }}>
                        {row.price == null ? '—' : Number(row.price).toLocaleString('en-IN')}
                      </td>
                      <td style={{ ...compact, textAlign: 'right', color: tone(row.day1d) }}>
                        {row.day1d == null
                          ? '—'
                          : `${Number(row.day1d) >= 0 ? '+' : ''}${Number(row.day1d).toFixed(2)}%`}
                      </td>
                      <td style={{ ...compact, textAlign: 'right' }}>
                        {row.fiiPct == null ? '—' : `${Number(row.fiiPct).toFixed(2)}%`}
                      </td>
                      <td style={{ ...compact, textAlign: 'right', color: tone(row.fiiPctDelta) }}>
                        {row.fiiPctDelta == null
                          ? '—'
                          : `${Number(row.fiiPctDelta) >= 0 ? '+' : ''}${Number(row.fiiPctDelta).toFixed(2)}`}
                      </td>
                    </tr>
                  ))}
                  {!sortedStocks.length ? (
                    <tr>
                      <td colSpan={5} style={{ ...compact, textAlign: 'center', color: '#888' }}>
                        No matching stocks in AYC sector map.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </Box>
          )}
        </Box>
      ) : null}
    </Box>
  );
}
