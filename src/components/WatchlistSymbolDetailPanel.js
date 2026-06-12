import React, { useCallback, useEffect, useState } from 'react';
import { Box, Paper, Tab, Tabs, Typography, IconButton, Button } from '@mui/material';
import { MdClose, MdDeleteOutline } from 'react-icons/md';
import FundamentalTabContent, { fmtFundVal } from './FundamentalTabContent';
import { fetchWatchlistFundamentals, refreshWatchlistFundamentals } from '../api/watchlist';

function TechnicalTabContent({ row, listType }) {
  if (!row) return <Typography color="text.secondary">Select a symbol.</Typography>;

  const longTermRows = [
    ['CMP', row.price != null ? `₹${Number(row.price).toFixed(2)}` : null],
    ['1D %', row.day1d != null ? `${row.day1d > 0 ? '+' : ''}${Number(row.day1d).toFixed(2)}%` : null],
    ['Score', row.composite_score],
    ['Rating', row.recommendation],
    ['Trend', row.trend],
    ['SuperTrend', row.supertrend_direction],
    ['MACD', row.macd_cross || row.macd],
    ['Volume ratio', row.volume_ratio != null ? `${Number(row.volume_ratio).toFixed(1)}x` : null],
    ['Entry', row.entry_price != null ? `₹${Number(row.entry_price).toFixed(2)}` : null],
    ['Stop loss', row.stop_loss != null ? `₹${Number(row.stop_loss).toFixed(2)}` : null],
    ['Target', row.target_long_term != null ? `₹${Number(row.target_long_term).toFixed(2)}` : null],
    ['Risk : reward', row.risk_reward_ratio != null ? `${row.risk_reward_ratio}:1` : null],
    ['Sector', row.sector],
    ['Subsector', row.subsector],
  ];

  const shortTermRows = [
    ['CMP', row.price != null ? `₹${Number(row.price).toFixed(2)}` : null],
    ['1D %', row.day1d != null ? `${row.day1d > 0 ? '+' : ''}${Number(row.day1d).toFixed(2)}%` : null],
    ['Market cap', row.market_cap],
    ['Signal tier', row.buy_sell_tier],
    ['Score', row.signal_score],
    ['SuperTrend', row.supertrend_direction],
    ['RSI', row.rsi],
    ['MACD', row.macd_cross || row.macd],
    ['Volume ratio', row.volume_ratio != null ? `${Number(row.volume_ratio).toFixed(1)}x` : null],
    ['Entry', row.entry_price != null ? `₹${Number(row.entry_price).toFixed(2)}` : null],
    ['Stop loss', row.stop_loss != null ? `₹${Number(row.stop_loss).toFixed(2)}` : null],
    ['Target', row.target_short_term != null ? `₹${Number(row.target_short_term).toFixed(2)}` : null],
    ['Sector', row.sector],
    ['Subsector', row.subsector],
  ];

  const items = (listType === 'short_term' ? shortTermRows : longTermRows).map(([label, value]) => ({
    label,
    value: fmtFundVal(value),
  }));

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 0 }}>
      {items.map(({ label, value }) => (
        <Box
          key={label}
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            py: 0.75,
            px: 1,
            borderBottom: '1px solid #eee',
            gap: 2,
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600, color: '#444' }}>{label}</Typography>
          <Typography variant="body2">{value}</Typography>
        </Box>
      ))}
    </Box>
  );
}

/**
 * Inline panel below the watchlist table: Fundamentals (9 sections) + Technicals.
 * TradingView chart link stays in the table row (not replaced).
 */
export default function WatchlistSymbolDetailPanel({
  symbol,
  row,
  listType = 'long_term',
  onClose,
  onRemove,
  removing = false,
  onFundamentalsUpdated,
}) {
  const [mainTab, setMainTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState('');

  const loadSnapshot = useCallback(async (sym, tryRefresh = false) => {
    if (!sym) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchWatchlistFundamentals(sym);
      setSnapshot(data);
      if (onFundamentalsUpdated) onFundamentalsUpdated(sym, data);
    } catch (e) {
      if (tryRefresh) {
        setRefreshing(true);
        try {
          await refreshWatchlistFundamentals([sym]);
          const data = await fetchWatchlistFundamentals(sym);
          setSnapshot(data);
          if (onFundamentalsUpdated) onFundamentalsUpdated(sym, data);
        } catch (e2) {
          setError(e2?.message || 'Could not load fundamentals');
          setSnapshot(null);
        } finally {
          setRefreshing(false);
        }
      } else {
        setError(e?.message || 'Fundamentals not loaded yet');
        setSnapshot(null);
      }
    } finally {
      setLoading(false);
    }
  }, [onFundamentalsUpdated]);

  useEffect(() => {
    if (!symbol) {
      setSnapshot(null);
      setError('');
      return undefined;
    }
    setMainTab(0);
    loadSnapshot(symbol, !row?.fundamentals);
    return undefined;
  }, [symbol, loadSnapshot, row?.fundamentals]);

  const handleRefresh = async () => {
    if (!symbol) return;
    setRefreshing(true);
    try {
      await refreshWatchlistFundamentals([symbol]);
      await loadSnapshot(symbol, false);
    } catch (e) {
      setError(e?.message || 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  };

  if (!symbol) return null;

  return (
    <Paper
      elevation={0}
      sx={{
        mt: 2,
        p: 2,
        border: '2px solid #ca8a04',
        borderRadius: 2,
        bgcolor: '#fffbeb',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, color: '#1a3c5e' }}>
          {symbol}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ ml: 1.5 }}>
          Fundamentals & technicals (in-app)
        </Typography>
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {onRemove ? (
            <Button
              size="small"
              color="error"
              variant="outlined"
              startIcon={<MdDeleteOutline />}
              onClick={() => onRemove(symbol)}
              disabled={removing}
              sx={{ textTransform: 'none', fontSize: 12, mr: 0.5 }}
            >
              {removing ? 'Removing…' : 'Remove from list'}
            </Button>
          ) : null}
          <IconButton size="small" onClick={onClose} aria-label="Close detail panel">
            <MdClose />
          </IconButton>
        </Box>
      </Box>

      <Tabs
        value={mainTab}
        onChange={(_, v) => setMainTab(v)}
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label="Fundamentals" sx={{ textTransform: 'none', fontWeight: 700 }} />
        <Tab label="Technicals" sx={{ textTransform: 'none', fontWeight: 700 }} />
      </Tabs>

      {mainTab === 0 ? (
        <FundamentalTabContent
          symbol={symbol}
          snapshot={snapshot}
          loading={loading || refreshing}
          error={error}
          technicalRow={row}
          onRefresh={handleRefresh}
          refreshing={refreshing}
        />
      ) : (
        <TechnicalTabContent row={row} listType={listType} />
      )}
    </Paper>
  );
}
