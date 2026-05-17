import React from 'react';
import {
  Box,
  CircularProgress,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Typography,
  Chip,
  Button,
} from '@mui/material';

export const FUNDAMENTAL_TAB_ORDER = [
  ['overview', 'Overview'],
  ['performance', 'Performance'],
  ['valuation', 'Valuation'],
  ['dividends', 'Dividends'],
  ['profitability', 'Profitability'],
  ['income', 'Income'],
  ['balance_sheet', 'Balance sheet'],
  ['cash_flow', 'Cash flow'],
  ['technicals', 'Technicals'],
];

export const fmtFundVal = (v) => {
  if (v == null || v === '') return '—';
  if (typeof v === 'number') {
    const abs = Math.abs(v);
    if (abs >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
    if (abs < 1 && abs > 0) return `${(v * 100).toFixed(2)}%`;
    return Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }
  return String(v);
};

export const rowsFromFundObj = (obj) => {
  if (!obj || typeof obj !== 'object') return [];
  return Object.entries(obj)
    .filter(([k]) => !k.startsWith('_'))
    .map(([k, v]) => ({
      label: k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      value: fmtFundVal(v),
    }));
};

export default function FundamentalTabContent({
  symbol,
  snapshot,
  loading,
  error,
  technicalRow,
  onRefresh,
  refreshing,
}) {
  const [subTab, setSubTab] = React.useState(0);

  React.useEffect(() => {
    setSubTab(0);
  }, [symbol]);

  const tabs = { ...(snapshot?.tabs || {}) };
  if (technicalRow) {
    tabs.technicals = {
      ...(tabs.technicals || {}),
      rsi: technicalRow.rsi,
      macd: technicalRow.macd,
      macd_cross: technicalRow.macd_cross,
      supertrend: technicalRow.supertrend_direction,
      volume_ratio: technicalRow.volume_ratio,
      signal_score: technicalRow.signal_score ?? technicalRow.composite_score,
      recommendation: technicalRow.recommendation,
      buy_sell_tier: technicalRow.buy_sell_tier,
    };
  }

  const [tabKey] = FUNDAMENTAL_TAB_ORDER[subTab] || ['overview', 'Overview'];
  const rows = rowsFromFundObj(tabs[tabKey]);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
        {snapshot?.fiscal_period ? <Chip size="small" label={`Fiscal ${snapshot.fiscal_period}`} /> : null}
        {snapshot?.fetched_at ? (
          <Typography variant="caption" color="text.secondary">
            Updated {snapshot.fetched_at}
          </Typography>
        ) : null}
        {onRefresh ? (
          <Button size="small" variant="outlined" onClick={onRefresh} disabled={refreshing} sx={{ textTransform: 'none', ml: 'auto' }}>
            {refreshing ? 'Loading…' : 'Refresh data'}
          </Button>
        ) : null}
      </Box>
      <Tabs
        value={subTab}
        onChange={(_, v) => setSubTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 1.5, borderBottom: 1, borderColor: 'divider', minHeight: 40 }}
      >
        {FUNDAMENTAL_TAB_ORDER.map(([, label]) => (
          <Tab key={label} label={label} sx={{ textTransform: 'none', minHeight: 40, py: 0.5 }} />
        ))}
      </Tabs>
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={28} />
        </Box>
      ) : error ? (
        <Typography color="text.secondary" sx={{ py: 2 }}>
          {error}
          {onRefresh ? ' Use Refresh data to fetch from yfinance and screener.in.' : ''}
        </Typography>
      ) : rows.length ? (
        <Table size="small" sx={{ maxWidth: 720 }}>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.label}>
                <TableCell sx={{ fontWeight: 600, width: '42%', borderBottom: '1px solid #eee' }}>{r.label}</TableCell>
                <TableCell sx={{ borderBottom: '1px solid #eee' }}>{r.value}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <Typography color="text.secondary">No data for this section yet.</Typography>
      )}
    </Box>
  );
}
