import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Tooltip, IconButton } from '@mui/material';
import { MdRefresh, MdTrendingUp, MdTrendingDown, MdRemoveRedEye } from 'react-icons/md';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RTooltip } from 'recharts';
import { useLocation, useNavigate } from 'react-router';
import { fetchMarketIndices } from '../api/marketIndices';
import { fetchSectorOutlook } from '../api/sectorOutlook';
import {
  fetchPriceShockersRaw,
  fetchTrendingRaw,
  mapPriceShockersList,
  mapStockListToTable,
} from '../api/stocks';
import { fetchAlerts, fetchRatings, fetchAdvisorWeeklyEntries, fetchLatestSignalsPayload } from '../api/advisor';
import { apiGet, clearApiGetCache } from '../api/apiClient';
import {
  fetchWatchlist,
  fetchWatchlistSignals,
  fetchOrderBlocks,
} from '../api/watchlist';
import { TELEGRAM_BOT_LABEL, TELEGRAM_BOT_URL } from '../constants/telegram';
import { fetchTelegramSubscribers } from '../api/telegram';
import { useAuth } from '../auth/AuthContext';
import { ensureMarketSession, getMarketPollingIntervalMs, isPageCacheStale, shouldPollLiveMarket } from '../utils/marketSession';
import { applyLiveSessionRefreshPolicy, applyPullRefreshPolicy, buildDashboardRefreshFallback, dashboardSectionsToRefresh, hasDashboardIndices, hasDashboardMovers, hasDashboardWatchlist, isDashboardCacheIncomplete, pickDashboardSectionRows } from '../utils/dashboardCachePolicy';
import { resolveDashboardBrokerHoldings } from '../utils/loadBrokerHoldings';
import { clearPageCache, readPageCache, shouldUseCachedPageDataOnly, writePageCache } from '../utils/pageDataCache';
import { ensureLegacyFormattedScreenCachesPurged } from '../utils/screenStockCache';
import { dedupeWeeklyEntriesBySymbol } from '../utils/weeklyEntries';

const COLORS_PIE = ['#1a3c5e', '#2e7d32', '#c62828', '#f57f17', '#6a1b9a', '#00838f', '#4e342e', '#37474f', '#e65100', '#1565c0'];
const fmt = (v, d = 2) => { if (v == null) return '—'; const n = +v; return isNaN(n) ? '—' : n.toFixed(d); };
const fmtPct = (v) => { if (v == null) return '—'; const n = +v; return isNaN(n) ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`; };
const fmtCur = (v) => { if (v == null) return '—'; const n = +v; return isNaN(n) ? '—' : `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; };
const pctColor = (v) => { const n = +v; if (isNaN(n) || n === 0) return '#666'; return n > 0 ? '#2e7d32' : '#c62828'; };
const parsePctNumber = (v) => {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = Number(String(v).replace(/[^\d.+-]/g, ''));
  return Number.isFinite(n) ? n : null;
};
const DASHBOARD_CACHE_KEY = 'dashboard_overview_cache_v11';
const LEGACY_DASHBOARD_CACHE_KEYS = [
  'dashboard_overview_cache_v10',
  'dashboard_overview_cache_v9',
  'dashboard_overview_cache_v8',
  'dashboard_overview_cache_v6',
  'dashboard_overview_cache_v7',
];

const settledValue = (result, fallback) => (result?.status === 'fulfilled' ? result.value : fallback);

function applyDashboardCache(setters, cached, marketModeFallback) {
  if (!cached) return;
  setters.setIndices(cached.indices || null);
  setters.setWatchlist(Array.isArray(cached.watchlist) ? cached.watchlist : []);
  setters.setSignals(Array.isArray(cached.signals) ? cached.signals : []);
  setters.setWeeklyData(dedupeWeeklyEntriesBySymbol(Array.isArray(cached.weeklyData) ? cached.weeklyData : []));
  setters.setAdvisorRegimeStocks(Array.isArray(cached.advisorRegimeStocks) ? cached.advisorRegimeStocks : []);
  setters.setObData(Array.isArray(cached.obData) ? cached.obData : []);
  setters.setSectors(Array.isArray(cached.sectors) ? cached.sectors : []);
  setters.setGainers(Array.isArray(cached.gainers) ? cached.gainers : []);
  setters.setLosers(Array.isArray(cached.losers) ? cached.losers : []);
  setters.setAlerts(Array.isArray(cached.alerts) ? cached.alerts : []);
  setters.setRatings(Array.isArray(cached.ratings) ? cached.ratings : []);
  setters.setTrendingStocks(Array.isArray(cached.trendingStocks) ? cached.trendingStocks : []);
  if (cached.marketMode) setters.setMarketMode(cached.marketMode);
  else if (marketModeFallback) setters.setMarketMode(marketModeFallback);
  setters.setLastUpdated(cached.updatedAt ? new Date(cached.updatedAt) : new Date());
}

const isAuthFailureMessage = (message) => {
  const m = String(message || '').toLowerCase();
  return m.includes('session expired')
    || m.includes('unauthorized')
    || m.includes('missing bearer')
    || m.includes('invalid credentials')
    || m.includes('request failed: 401');
};
const isFiniteNumber = (v) => typeof v === 'number' && Number.isFinite(v);

const watchlistDayPct = (row) => {
  if (!row || typeof row !== 'object') return null;
  if (isFiniteNumber(row.day1d)) return row.day1d;
  if (isFiniteNumber(row.day_pct)) return row.day_pct;
  if (isFiniteNumber(row.chg_pct)) return row.chg_pct;
  const raw = row.day1d ?? row.day_pct ?? row.chg_pct;
  if (raw == null || raw === '') return null;
  const n = Number(String(raw).replace(/%/g, '').trim());
  return Number.isFinite(n) ? n : null;
};
const deriveDirectionFromRow = (row) => {
  const reco = String(row?.recommendation || '').toLowerCase();
  if (reco.includes('sell')) return -1;
  if (reco.includes('buy')) return 1;
  const signalType = String(row?.signal_type || row?.trend || '').toLowerCase();
  if (signalType.includes('sell') || signalType.includes('bear')) return -1;
  return 1;
};
const normalizeMobile = (value) => String(value || '').replace(/\D/g, '');

/** One row per symbol — watchlist API can return the same ticker in short + long lists. */
const dedupeWatchlistBySymbol = (rows = []) => {
  const bySymbol = new Map();
  (rows || []).forEach((row) => {
    const symbol = String(row?.symbol || '').trim().toUpperCase();
    if (!symbol) return;
    const existing = bySymbol.get(symbol);
    if (!existing) {
      bySymbol.set(symbol, row);
      return;
    }
    const preferNew =
      (row.list_type === 'short_term' && existing.list_type !== 'short_term')
      || (watchlistDayPct(row) != null && watchlistDayPct(existing) == null);
    if (preferNew) bySymbol.set(symbol, row);
  });
  return Array.from(bySymbol.values());
};

const Card = ({ children, sx, ...props }) => (
  <Box sx={{ bgcolor: '#fff', borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.07)', p: 2, ...sx }} {...props}>{children}</Box>
);

const SectionTitle = ({ children, icon, action }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700, fontSize: 15, color: '#1a3c5e' }}>{icon}{children}</Box>
    {action}
  </Box>
);

const StatBox = ({ label, value, sub, color }) => (
  <Box sx={{ textAlign: 'center', minWidth: 80 }}>
    <Box sx={{ fontSize: 11, color: '#888', mb: 0.3 }}>{label}</Box>
    <Box sx={{ fontSize: 20, fontWeight: 700, color: color || '#1a3c5e' }}>{value}</Box>
    {sub && <Box sx={{ fontSize: 11, color: '#888' }}>{sub}</Box>}
  </Box>
);

// ─── Portfolio Snapshot ─────────────────────────────────────────────────────
function PortfolioSnapshot({ watchlist = [], signals = [], weeklyData = [] }) {
  const navigate = useNavigate();
  const all = useMemo(() => dedupeWatchlistBySymbol(watchlist), [watchlist]);
  const weekly = weeklyData;
  const sigArr = signals;
  const recoColors = { 'STRONG BUY': '#1b5e20', 'BUY': '#43a047', 'HOLD': '#f57f17', 'SELL': '#c62828', 'STRONG SELL': '#b71c1c', 'NEAR ENTRY': '#1565c0' };
  const {
    stCount,
    ltCount,
    gainers,
    losers,
    avg1d,
    best,
    worst,
    sectorData,
    recoData,
    bullish,
    bearish,
    overbought,
    oversold,
    avgScore,
    nearTarget,
    nearSL,
    nearEntry,
    inEntryZone,
    topMovers,
    overboughtSymbols,
    oversoldSymbols,
  } = useMemo(() => {
    const stCountMemo = watchlist.filter((w) => w.list_type === 'short_term').length;
    const ltCountMemo = watchlist.filter((w) => w.list_type === 'long_term').length;
    const rowsWithDay = all.filter((w) => watchlistDayPct(w) != null);
    const gainersMemo = rowsWithDay.filter((w) => watchlistDayPct(w) > 0);
    const losersMemo = rowsWithDay.filter((w) => watchlistDayPct(w) < 0);
    const avg1dMemo = rowsWithDay.length ? rowsWithDay.reduce((s, w) => s + watchlistDayPct(w), 0) / rowsWithDay.length : 0;
    const bestMemo = rowsWithDay.reduce((b, w) => (!b || watchlistDayPct(w) > watchlistDayPct(b)) ? w : b, null);
    const worstMemo = rowsWithDay.reduce((w2, w) => (!w2 || watchlistDayPct(w) < watchlistDayPct(w2)) ? w : w2, null);

    const sectorMap = {};
    all.forEach((w) => { const s = w.sector || 'Other'; sectorMap[s] = (sectorMap[s] || 0) + 1; });
    const sectorDataMemo = Object.entries(sectorMap).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));

    const recoMap = {};
    all.forEach((w) => { if (w.recommendation) { const k = w.recommendation.toUpperCase(); recoMap[k] = (recoMap[k] || 0) + 1; } });
    const recoOrder = ['STRONG BUY', 'BUY', 'HOLD', 'SELL', 'STRONG SELL'];
    const recoDataMemo = recoOrder.filter((k) => recoMap[k]).map((name) => ({ name, value: recoMap[name] }));
    Object.keys(recoMap).filter((k) => !recoOrder.includes(k)).forEach((k) => recoDataMemo.push({ name: k, value: recoMap[k] }));

    const bullishMemo = sigArr.filter((s) => isFiniteNumber(s?.signal_score) && s.signal_score > 25).length;
    const bearishMemo = sigArr.filter((s) => isFiniteNumber(s?.signal_score) && s.signal_score < -25).length;
    const overboughtRows = sigArr.filter((s) => isFiniteNumber(s?.rsi) && s.rsi > 70);
    const oversoldRows = sigArr.filter((s) => isFiniteNumber(s?.rsi) && s.rsi < 30);
    const overboughtMemo = overboughtRows.length;
    const oversoldMemo = oversoldRows.length;
    const overboughtSymbolsMemo = [...new Set(overboughtRows.map((s) => s.symbol).filter(Boolean))];
    const oversoldSymbolsMemo = [...new Set(oversoldRows.map((s) => s.symbol).filter(Boolean))];
    const scoredRows = all.filter((w) => Number.isFinite(Number(w.composite_score)));
    const avgScoreMemo = scoredRows.length ? scoredRows.reduce((s, w) => s + Number(w.composite_score || 0), 0) / scoredRows.length : 0;

    // Classify each symbol into a single nearest bucket to avoid overlaps like
    // the same stock appearing in Near Target and Near SL/Entry simultaneously.
    const nearestBySymbol = new Map();
    all.forEach((w) => {
      const symbol = String(w?.symbol || '').toUpperCase();
      if (!symbol) return;
      const price = Number(w?.price);
      if (!Number.isFinite(price) || price <= 0) return;
      const target = Number(w?.target_short_term);
      const stop = Number(w?.stop_loss);
      const targetGap = Number.isFinite(target) && target > 0 ? Math.abs(price - target) / target * 100 : null;
      const slGap = Number.isFinite(stop) && stop > 0 ? Math.abs(price - stop) / stop * 100 : null;
      const direction = deriveDirectionFromRow(w);
      const isBull = direction >= 0;
      const targetValid = targetGap != null && ((isBull && target >= price) || (!isBull && target <= price));
      const stopValid = slGap != null && ((isBull && stop <= price) || (!isBull && stop >= price));

      let bestType = null;
      let bestGap = Number.POSITIVE_INFINITY;
      if (targetValid && targetGap <= 5 && targetGap < bestGap) {
        bestType = 'target';
        bestGap = targetGap;
      }
      if (stopValid && slGap <= 5 && slGap < bestGap) {
        bestType = 'sl';
        bestGap = slGap;
      }
      if (!bestType) return;
      nearestBySymbol.set(symbol, { type: bestType, gap: bestGap, row: w });
    });

    const nearTargetMemo = Array.from(nearestBySymbol.values())
      .filter((x) => x.type === 'target')
      .map((x) => x.row);
    const nearSLMemo = Array.from(nearestBySymbol.values())
      .filter((x) => x.type === 'sl')
      .map((x) => x.row);

    const occupiedSymbols = new Set([
      ...nearTargetMemo.map((w) => String(w?.symbol || '').toUpperCase()),
      ...nearSLMemo.map((w) => String(w?.symbol || '').toUpperCase()),
    ]);
    const nearEntryMemo = weekly
      .filter((w) => (w.near_entry || (w.weekly_entry_gap_pct || 100) <= 10))
      .filter((w) => (w.weekly_entry_gap_pct || 100) <= 10)
      .filter((w) => !occupiedSymbols.has(String(w?.symbol || '').toUpperCase()));
    const inEntryZoneMemo = nearEntryMemo.filter((w) => (w.weekly_entry_gap_pct || 100) <= 5);
    const topMoversMemo = [...all].sort((a, b) => Math.abs(watchlistDayPct(b) || 0) - Math.abs(watchlistDayPct(a) || 0)).slice(0, 6);
    return {
      stCount: stCountMemo,
      ltCount: ltCountMemo,
      gainers: gainersMemo,
      losers: losersMemo,
      avg1d: avg1dMemo,
      best: bestMemo,
      worst: worstMemo,
      sectorData: sectorDataMemo,
      recoData: recoDataMemo,
      bullish: bullishMemo,
      bearish: bearishMemo,
      overbought: overboughtMemo,
      oversold: oversoldMemo,
      avgScore: avgScoreMemo,
      nearTarget: nearTargetMemo,
      nearSL: nearSLMemo,
      nearEntry: nearEntryMemo,
      inEntryZone: inEntryZoneMemo,
      topMovers: topMoversMemo,
      overboughtSymbols: overboughtSymbolsMemo,
      oversoldSymbols: oversoldSymbolsMemo,
    };
  }, [all, weekly, sigArr, watchlist]);

  if (!all.length) return (
    <Card sx={{ textAlign: 'center', py: 4, color: '#888' }}>
      No stocks in watchlist. Add stocks from <b>Short Term</b> or <b>Long Term</b> pages.
    </Card>
  );

  const gotoShortTermFiltered = (rows = [], label = '') => {
    const symbols = [...new Set((rows || []).map((r) => String(r?.symbol || '').toUpperCase()).filter(Boolean))];
    if (!symbols.length) return;
    navigate('/short-term', {
      state: {
        prefilterSymbols: symbols,
        prefilterLabel: label || 'Filtered',
      },
    });
  };

  return (
    <Card>
      <SectionTitle icon={<MdRemoveRedEye />} action={
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Chip label={`${stCount} Short Term`} size="small" sx={{ bgcolor: '#e3f2fd', fontWeight: 600, fontSize: 11 }} onClick={() => navigate('/short-term')} />
          <Chip label={`${ltCount} Long Term`} size="small" sx={{ bgcolor: '#fce4ec', fontWeight: 600, fontSize: 11 }} onClick={() => navigate('/long-term')} />
        </Box>
      }>Portfolio Snapshot ({all.length} stocks)</SectionTitle>

      {/* Row 1: Key metrics */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 1.2, mb: 2, bgcolor: '#f8f9fa', borderRadius: 1.5, py: 1.5, px: 1 }}>
        <StatBox label="Avg 1D Return" value={fmtPct(avg1d)} color={pctColor(avg1d)} />
        <StatBox label="Advance" value={gainers.length} color="#2e7d32" sub={`of ${all.length}`} />
        <StatBox label="Decline" value={losers.length} color="#c62828" sub={`of ${all.length}`} />
        <StatBox label="Avg Score" value={avgScore ? fmt(avgScore, 0) : '—'} color={avgScore > 60 ? '#2e7d32' : avgScore > 40 ? '#f57f17' : '#c62828'} sub="/100" />
        <StatBox label="Bullish" value={bullish} color="#2e7d32" sub={`/ ${sigArr.length} signals`} />
        <StatBox label="Bearish" value={bearish} color="#c62828" sub={`/ ${sigArr.length} signals`} />
        <Box sx={{ cursor: nearEntry.length ? 'pointer' : 'default' }} onClick={() => gotoShortTermFiltered(nearEntry, 'Near Entry')}>
          <StatBox label="Near Entry" value={nearEntry.length} color="#1565c0" sub={`≤10% gap`} />
        </Box>
      </Box>

      {/* Row 2: Best/Worst + Alerts */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 1.5, mb: 2 }}>
        {best && watchlistDayPct(best) > 0 && (
          <Box sx={{ bgcolor: '#e8f5e9', borderRadius: 1.5, p: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            <MdTrendingUp color="#2e7d32" size={22} />
            <Box>
              <Box sx={{ fontSize: 11, color: '#666' }}>Best Today</Box>
              <Box sx={{ fontWeight: 700, fontSize: 14 }}>{best.symbol} <span style={{ color: '#2e7d32' }}>{fmtPct(watchlistDayPct(best))}</span></Box>
            </Box>
          </Box>
        )}
        {worst && watchlistDayPct(worst) < 0 && (
          <Box sx={{ bgcolor: '#ffebee', borderRadius: 1.5, p: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            <MdTrendingDown color="#c62828" size={22} />
            <Box>
              <Box sx={{ fontSize: 11, color: '#666' }}>Worst Today</Box>
              <Box sx={{ fontWeight: 700, fontSize: 14 }}>{worst.symbol} <span style={{ color: '#c62828' }}>{fmtPct(watchlistDayPct(worst))}</span></Box>
            </Box>
          </Box>
        )}
        {nearTarget.length > 0 && (
          <Box
            onClick={() => gotoShortTermFiltered(nearTarget, 'Near Target')}
            sx={{ bgcolor: '#fff3e0', borderRadius: 1.5, p: 1.5, cursor: 'pointer' }}
          >
            <Box sx={{ fontSize: 11, color: '#e65100', fontWeight: 600 }}>Near Target ({nearTarget.length})</Box>
            <Box sx={{ fontSize: 12, mt: 0.3 }}>{nearTarget.map(n => n.symbol).join(', ')}</Box>
          </Box>
        )}
        {nearSL.length > 0 && (
          <Box
            onClick={() => gotoShortTermFiltered(nearSL, 'Near Stop Loss')}
            sx={{ bgcolor: '#fce4ec', borderRadius: 1.5, p: 1.5, cursor: 'pointer' }}
          >
            <Box sx={{ fontSize: 11, color: '#c62828', fontWeight: 600 }}>Near Stop Loss ({nearSL.length})</Box>
            <Box sx={{ fontSize: 12, mt: 0.3 }}>{nearSL.map(n => n.symbol).join(', ')}</Box>
          </Box>
        )}
        {overbought > 0 && (
          <Box sx={{ bgcolor: '#fff8e1', borderRadius: 1.5, p: 1.5 }}>
            <Box sx={{ fontSize: 11, color: '#f57f17', fontWeight: 600 }}>RSI &gt; 70 ({overbought})</Box>
            <Box sx={{ fontSize: 12, mt: 0.3 }}>{overboughtSymbols.join(', ')}</Box>
          </Box>
        )}
        {oversold > 0 && (
          <Box sx={{ bgcolor: '#e0f7fa', borderRadius: 1.5, p: 1.5 }}>
            <Box sx={{ fontSize: 11, color: '#00838f', fontWeight: 600 }}>RSI &lt; 30 ({oversold})</Box>
            <Box sx={{ fontSize: 12, mt: 0.3 }}>{oversoldSymbols.join(', ')}</Box>
          </Box>
        )}
        {inEntryZone.length > 0 && (
          <Box
            onClick={() => gotoShortTermFiltered(inEntryZone, 'In Entry Zone ≤5%')}
            sx={{ bgcolor: '#e8eaf6', borderRadius: 1.5, p: 1.5, cursor: 'pointer' }}
          >
            <Box sx={{ fontSize: 11, color: '#283593', fontWeight: 600 }}>In Entry Zone ≤5% ({inEntryZone.length})</Box>
            <Box sx={{ fontSize: 12, mt: 0.3 }}>{inEntryZone.map(w => w.symbol).join(', ')}</Box>
          </Box>
        )}
        {nearEntry.length > inEntryZone.length && (
          <Box
            onClick={() => gotoShortTermFiltered(nearEntry.filter(w => (w.weekly_entry_gap_pct || 0) > 5), 'Near Entry 5-10%')}
            sx={{ bgcolor: '#e3f2fd', borderRadius: 1.5, p: 1.5, cursor: 'pointer' }}
          >
            <Box sx={{ fontSize: 11, color: '#1565c0', fontWeight: 600 }}>Near Entry 5-10% ({nearEntry.length - inEntryZone.length})</Box>
            <Box sx={{ fontSize: 12, mt: 0.3 }}>{nearEntry.filter(w => (w.weekly_entry_gap_pct || 0) > 5).map(w => w.symbol).join(', ')}</Box>
          </Box>
        )}
      </Box>

      {/* Row 3: Charts + Reco split */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2, '@media (max-width: 900px)': { gridTemplateColumns: '1fr' } }}>
        {/* Sector Allocation */}
        <Box>
          <Box sx={{ fontSize: 12, fontWeight: 600, color: '#555', mb: 0.5 }}>Sector Allocation</Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ResponsiveContainer width={120} height={120}>
              <PieChart>
                <Pie data={sectorData} dataKey="value" cx="50%" cy="50%" outerRadius={50} innerRadius={25} paddingAngle={2} strokeWidth={0}>
                  {sectorData.map((_, i) => <Cell key={i} fill={COLORS_PIE[i % COLORS_PIE.length]} />)}
                </Pie>
                <RTooltip formatter={(v, n) => [`${v} stocks`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <Box sx={{ flex: 1, fontSize: 11 }}>
              {sectorData.slice(0, 5).map((s, i) => (
                <Box key={s.name} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.3 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: COLORS_PIE[i % COLORS_PIE.length], flexShrink: 0 }} />
                  <span>{s.name}</span>
                  <span style={{ marginLeft: 'auto', fontWeight: 600 }}>{s.value}</span>
                </Box>
              ))}
              {sectorData.length > 5 && <Box sx={{ color: '#999', mt: 0.3 }}>+{sectorData.length - 5} more</Box>}
            </Box>
          </Box>
        </Box>

        {/* Recommendation Split + Near Entry */}
        <Box>
          <Box sx={{ fontSize: 12, fontWeight: 600, color: '#555', mb: 0.5 }}>Recommendation Split</Box>
          {recoData.length > 0 || nearEntry.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {[...recoData, { name: 'NEAR ENTRY', value: nearEntry.length }].map(r => (
                <Box key={r.name} sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 12 }}>
                  <Box sx={{ width: 90, fontWeight: 700, color: recoColors[r.name] || '#555', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3 }}>{r.name}</Box>
                  <Box sx={{ flex: 1, bgcolor: '#f0f0f0', borderRadius: 1, height: 18, overflow: 'hidden' }}>
                    <Box sx={{ width: `${all.length ? (r.value / all.length) * 100 : 0}%`, height: '100%', bgcolor: recoColors[r.name] || '#888', borderRadius: 1, minWidth: r.value ? 6 : 0 }} />
                  </Box>
                  <Box sx={{ fontWeight: 700, width: 24, textAlign: 'right', fontSize: 12 }}>{r.value}</Box>
                </Box>
              ))}
            </Box>
          ) : <Box sx={{ color: '#999', fontSize: 12 }}>No ratings available</Box>}
        </Box>
      </Box>

      {/* Row 4: Top movers compact table */}
      <Box sx={{ fontSize: 12, fontWeight: 600, color: '#555', mb: 0.5 }}>Top Movers in Watchlist</Box>
      <Box sx={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: '#555', fontWeight: 600 }}>Symbol</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', color: '#555', fontWeight: 600 }}>CMP</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', color: '#555', fontWeight: 600 }}>1D</th>
              <th style={{ textAlign: 'center', padding: '6px 8px', color: '#555', fontWeight: 600 }}>Reco</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', color: '#555', fontWeight: 600 }}>Score</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: '#555', fontWeight: 600 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {topMovers.map((w, idx) => {
              let status = '—';
              if (w.price && w.target_short_term && Math.abs(w.price - w.target_short_term) / w.target_short_term < 0.05) status = 'Near Target';
              else if (w.price && w.stop_loss && Math.abs(w.price - w.stop_loss) / w.stop_loss < 0.05) status = 'Near SL';
              else if (w.signal_type) status = String(w.signal_type).replace(/_/g, ' ').toUpperCase();
              else if (w.trend) status = String(w.trend).toUpperCase();
              const statusColor =
                status === 'Near SL' ? '#c62828'
                  : status === 'Near Target' ? '#e65100'
                    : status.includes('STRONG BUY') || status.includes('BUY') || status === 'BULLISH' ? '#2e7d32'
                      : status.includes('STRONG SELL') || status.includes('SELL') || status === 'BEARISH' ? '#c62828'
                        : status === 'SIDEWAYS' || status === 'HOLD' ? '#555'
                          : '#888';
              return (
                <tr key={`${w.symbol}-${w.id ?? idx}`} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '6px 8px', fontWeight: 600 }}>{w.symbol}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmtCur(w.price)}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: pctColor(watchlistDayPct(w)), fontWeight: 600 }}>{fmtPct(watchlistDayPct(w))}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                    {w.recommendation ? <Chip label={w.recommendation.toUpperCase()} size="small" sx={{ fontSize: 10, fontWeight: 700, height: 20, bgcolor: recoColors[w.recommendation.toUpperCase()] || '#888', color: '#fff' }} /> : '—'}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>{w.composite_score ? fmt(w.composite_score, 0) : '—'}</td>
                  <td style={{ padding: '6px 8px', fontSize: 11, color: statusColor }}>{status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Box>
    </Card>
  );
}

// ─── Relative To Index (Regime Buckets) ─────────────────────────────────────
function RelativeRegimeBoard({ stocks = [], indices = null }) {
  const [statusMsg, setStatusMsg] = useState('');
  const benchmark = useMemo(() => {
    const cards = [...(indices?.indexCards || []), ...(indices?.smallcapCards || [])];
    if (!cards.length) return 0;
    const preferred = cards.filter((c) => /nifty 50|sensex/i.test(String(c?.title || '')));
    const pool = preferred.length ? preferred : cards;
    const vals = pool
      .map((c) => parsePctNumber(c?.change))
      .filter((v) => Number.isFinite(v));
    if (!vals.length) return 0;
    return vals.reduce((s, x) => s + x, 0) / vals.length;
  }, [indices]);

  const groupedRows = useMemo(() => {
    const byType = {
      accelerating: new Set(),
      recovering: new Set(),
      decelerating: new Set(),
      underperforming: new Set(),
    };
    const rows = Array.isArray(stocks) ? stocks : [];
    rows.forEach((row) => {
      const symbol = String(row?.symbol || '').trim().toUpperCase();
      if (!symbol) return;
      const day1d = Number(row?.day1d);
      if (!Number.isFinite(day1d)) return;
      const day1w = Number(row?.day1w);
      const alpha = day1d - benchmark;

      if (day1d > benchmark + 0.4) {
        byType.accelerating.add(symbol);
      } else if (day1d > 0 && alpha < -0.4) {
        byType.decelerating.add(symbol);
      } else if (day1d <= 0 && alpha < 0) {
        byType.underperforming.add(symbol);
      } else if (day1d > 0 && (day1w < 0 || alpha <= 0.4)) {
        byType.recovering.add(symbol);
      }
    });

    const ordered = [
      { key: 'accelerating', label: 'accelerating' },
      { key: 'recovering', label: 'recovering' },
      { key: 'decelerating', label: 'decelerating' },
      { key: 'underperforming', label: 'underperforming' },
    ];
    return ordered
      .map(({ key, label }) => {
        const symbols = [...byType[key]].sort();
        return {
          regimeType: label,
          count: symbols.length,
          symbols,
          csv: symbols.join(','),
        };
      })
      .filter((r) => r.count > 0);
  }, [stocks, benchmark]);

  const handleCopyCsv = async (csvText, label) => {
    if (!csvText) return;
    try {
      await navigator.clipboard.writeText(csvText);
      const cnt = csvText.split(',').filter(Boolean).length;
      setStatusMsg(`Copied ${cnt} symbols for ${label}.`);
    } catch (_) {
      setStatusMsg(`Copy failed for ${label}.`);
    }
  };

  return (
    <Card>
      <SectionTitle>Stocks vs Indices Regime Board</SectionTitle>
      <Box sx={{ fontSize: 11, color: '#666', mb: 1 }}>
        Advisor-qualified setups vs index benchmark (NIFTY 50 / SENSEX day change). Current benchmark: <b>{fmtPct(benchmark)}</b>
      </Box>
      {statusMsg ? <Alert severity="info" sx={{ mb: 1 }}>{statusMsg}</Alert> : null}
      <Box sx={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: '#555', fontWeight: 700 }}>Regime</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', color: '#555', fontWeight: 700 }}>Unique Stocks</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: '#555', fontWeight: 700 }}>Symbols (CSV)</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: '#555', fontWeight: 700 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {groupedRows.map((r) => (
              <tr key={r.regimeType} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '6px 8px', fontWeight: 700 }}>{r.regimeType}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right' }}>{r.count}</td>
                <td style={{ padding: '6px 8px', wordBreak: 'break-word' }}>{r.csv}</td>
                <td style={{ padding: '6px 8px' }}>
                  <Button size="small" variant="text" sx={{ textTransform: 'none' }} onClick={() => handleCopyCsv(r.csv, r.regimeType)}>
                    Copy CSV
                  </Button>
                </td>
              </tr>
            ))}
            {!groupedRows.length ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: 16, color: '#888' }}>
                  Not enough advisor-qualified stocks with day change to classify right now.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Box>
    </Card>
  );
}

// ─── Weekly Entries (MyIndicator: PSAR + SuperTrend + Fibonacci) ────────────
function WeeklyEntries({ weeklyData = [] }) {
  const rows = useMemo(() => dedupeWeeklyEntriesBySymbol(weeklyData), [weeklyData]);
  const MAX_ENTRY_GAP_PCT = 5;
  const deriveWeeklyEntryStop = (w) => {
    const psar = Number(w?.weekly_psar);
    const st = Number(w?.weekly_supertrend);
    const direction = String(w?.weekly_supertrend_direction || '').toLowerCase();
    const hasPsar = Number.isFinite(psar);
    const hasSt = Number.isFinite(st);
    if (hasPsar && hasSt) {
      if (direction === 'up') {
        return { entry: Math.max(psar, st), stopLoss: Math.min(psar, st) };
      }
      if (direction === 'down') {
        return { entry: Math.min(psar, st), stopLoss: Math.max(psar, st) };
      }
    }
    return {
      entry: Number.isFinite(Number(w?.weekly_entry)) ? Number(w.weekly_entry) : null,
      stopLoss: Number.isFinite(Number(w?.weekly_stop_loss)) ? Number(w.weekly_stop_loss) : null,
    };
  };

  const nearEntries = useMemo(
    () => rows
      .map((w) => {
        const { entry, stopLoss } = deriveWeeklyEntryStop(w);
        const direction = String(w?.weekly_supertrend_direction || '').toLowerCase();
        const price = Number(w?.price);
        const sl = Number.isFinite(stopLoss) ? stopLoss : Number(w?.weekly_stop_loss);
        const computedGap = (Number.isFinite(price) && price > 0 && Number.isFinite(entry) && entry > 0)
          ? Math.abs(price - entry) / entry * 100
          : Number(w?.weekly_entry_gap_pct);
        const riskDistance = (
          Number.isFinite(entry)
          && Number.isFinite(sl)
          && Math.abs(entry - sl) > 0
        ) ? Math.abs(entry - sl) : null;

        let fib1 = Number(w?.fib_target_1);
        let fib2 = Number(w?.fib_target_2);
        const fibInvalid = !Number.isFinite(fib1) || !Number.isFinite(fib2)
          || (direction === 'up' && (fib1 < entry || fib2 < fib1))
          || (direction === 'down' && (fib1 > entry || fib2 > fib1));
        if (fibInvalid && Number.isFinite(entry) && Number.isFinite(riskDistance) && riskDistance > 0) {
          if (direction === 'up') {
            fib1 = entry + (riskDistance * 1.272);
            fib2 = entry + (riskDistance * 1.618);
          } else if (direction === 'down') {
            fib1 = entry - (riskDistance * 1.272);
            fib2 = entry - (riskDistance * 1.618);
          }
        }

        return {
          ...w,
          weekly_entry: Number.isFinite(entry) ? entry : w?.weekly_entry,
          weekly_stop_loss: Number.isFinite(stopLoss) ? stopLoss : sl,
          weekly_entry_gap_pct: Number.isFinite(computedGap) ? computedGap : w?.weekly_entry_gap_pct,
          fib_target_1: Number.isFinite(fib1) ? fib1 : w?.fib_target_1,
          fib_target_2: Number.isFinite(fib2) ? fib2 : w?.fib_target_2,
        };
      })
      .filter((w) => (w.weekly_entry_gap_pct || 100) <= MAX_ENTRY_GAP_PCT)
      .sort((a, b) => (a.weekly_entry_gap_pct || 100) - (b.weekly_entry_gap_pct || 100)),
    [rows]
  );
  const visibleRows = dedupeWeeklyEntriesBySymbol(nearEntries).slice(0, 25);

  if (!rows.length) {
    return (
      <Card>
        <SectionTitle>Weekly Entries — MyIndicator (PSAR + SuperTrend + Fib)</SectionTitle>
        <Box sx={{ fontSize: 12, color: '#777' }}>
          No advisor-qualified weekly entry setups within 5% of the PSAR/SuperTrend zone right now.
        </Box>
      </Card>
    );
  }
  if (!nearEntries.length) {
    return (
      <Card>
        <SectionTitle>Weekly Entries — MyIndicator (PSAR + SuperTrend + Fib)</SectionTitle>
        <Box sx={{ fontSize: 12, color: '#777' }}>
          No near-entry advisor weekly setups found right now.
        </Box>
      </Card>
    );
  }

  const dirColor = (d) => d === 'up' ? '#2e7d32' : d === 'down' ? '#c62828' : '#888';
  const dirLabel = (d) => d === 'up' ? 'BULLISH' : d === 'down' ? 'BEARISH' : 'NEUTRAL';

  return (
    <Card>
      <SectionTitle>Weekly Entries — MyIndicator (PSAR + SuperTrend + Fib)</SectionTitle>
      <Box sx={{ fontSize: 11, color: '#888', mb: 1 }}>
        Advisor-qualified stocks within {MAX_ENTRY_GAP_PCT}% of weekly PSAR/SuperTrend entry zone.
      </Box>
      <Box sx={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: '#555', fontWeight: 600 }}>Symbol</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', color: '#555', fontWeight: 600 }}>CMP</th>
              <th style={{ textAlign: 'center', padding: '6px 8px', color: '#555', fontWeight: 600 }}>W.Trend</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', color: '#555', fontWeight: 600 }}>W.PSAR</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', color: '#555', fontWeight: 600 }}>W.ST</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', color: '#1565c0', fontWeight: 600 }}>Entry</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', color: '#555', fontWeight: 600 }}>Gap%</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', color: '#555', fontWeight: 600 }}>SL</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', color: '#2e7d32', fontWeight: 600 }}>Fib T1</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', color: '#2e7d32', fontWeight: 600 }}>Fib T2</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map(w => {
              const gap = w.weekly_entry_gap_pct || 0;
              const gapColor = gap <= 3 ? '#283593' : '#1565c0';
              return (
                <tr key={w.symbol} style={{ borderBottom: '1px solid #f0f0f0', backgroundColor: gap <= 3 ? '#e8eaf6' : 'transparent' }}>
                  <td style={{ padding: '6px 8px', fontWeight: 700 }}>{w.symbol}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmtCur(w.price)}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                    <Chip label={dirLabel(w.weekly_supertrend_direction)} size="small"
                      sx={{ fontSize: 9, height: 18, fontWeight: 700, bgcolor: dirColor(w.weekly_supertrend_direction), color: '#fff' }} />
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: 11 }}>{fmtCur(w.weekly_psar)}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: 11 }}>{fmtCur(w.weekly_supertrend)}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#1565c0' }}>{fmtCur(w.weekly_entry)}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: gapColor }}>{fmt(gap, 1)}%</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: '#c62828', fontSize: 11 }}>{fmtCur(w.weekly_stop_loss)}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: '#2e7d32', fontWeight: 600 }}>{fmtCur(w.fib_target_1)}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: '#2e7d32' }}>{fmtCur(w.fib_target_2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Box>
      <Box sx={{ mt: 1, fontSize: 10, color: '#999', display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        {nearEntries.length > visibleRows.length && (
          <span>Showing top {visibleRows.length} nearest setups ({nearEntries.length} found)</span>
        )}
        <span><b style={{ color: '#283593' }}>Dark Blue</b> = ≤3% from entry</span>
        <span><b style={{ color: '#1565c0' }}>Blue</b> = 3-5% from entry</span>
        <span>Entry = max(W.PSAR, W.SuperTrend) for bullish / min for bearish; SL uses opposite boundary</span>
        <span>Targets = Fibonacci extension (1.272x, 1.618x)</span>
      </Box>
    </Card>
  );
}

// ─── Order Block Zones (Multi-Timeframe) ────────────────────────────────────
function OrderBlockZones({ obData }) {
  if (!obData || !obData.length) {
    return (
      <Card>
        <SectionTitle>Order Block Setups (MTF Top-Down)</SectionTitle>
        <Box sx={{ fontSize: 12, color: '#777' }}>
          Order block data is currently unavailable.
        </Box>
      </Card>
    );
  }

  const gradeColor = { A: '#1b5e20', B: '#43a047', C: '#f57f17', D: '#c62828' };
  const gradeBg = { A: '#e8f5e9', B: '#f1f8e9', C: '#fff8e1', D: '#ffebee' };
  const trendColor = (t) => t === 'up' ? '#2e7d32' : t === 'down' ? '#c62828' : '#888';
  const strengthIcon = (s) => s === 'strong' ? '███' : s === 'moderate' ? '██░' : '█░░';

  return (
    <Card>
      <SectionTitle>Order Block Setups (MTF Top-Down)</SectionTitle>
      <Box sx={{ fontSize: 11, color: '#888', mb: 1 }}>
        Weekly OB zone → Daily trend confirmation → Entry with tight SL. Sorted by grade then proximity.
      </Box>
      <Box sx={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e0e0e0', backgroundColor: '#fafafa' }}>
              <th style={{ textAlign: 'center', padding: '5px 6px', color: '#555', fontWeight: 700, fontSize: 10 }}>Grade</th>
              <th style={{ textAlign: 'left', padding: '5px 6px', color: '#555', fontWeight: 700, fontSize: 10 }}>Symbol</th>
              <th style={{ textAlign: 'right', padding: '5px 6px', color: '#555', fontWeight: 700, fontSize: 10 }}>CMP</th>
              <th style={{ textAlign: 'center', padding: '5px 6px', color: '#555', fontWeight: 700, fontSize: 10 }}>W.Trend</th>
              <th style={{ textAlign: 'center', padding: '5px 6px', color: '#555', fontWeight: 700, fontSize: 10 }}>D.Trend</th>
              <th style={{ textAlign: 'center', padding: '5px 6px', color: '#555', fontWeight: 700, fontSize: 10 }}>Strength</th>
              <th style={{ textAlign: 'center', padding: '5px 6px', color: '#555', fontWeight: 700, fontSize: 10 }}>Zone</th>
              <th style={{ textAlign: 'right', padding: '5px 6px', color: '#555', fontWeight: 700, fontSize: 10 }}>OB Range</th>
              <th style={{ textAlign: 'right', padding: '5px 6px', color: '#555', fontWeight: 700, fontSize: 10 }}>Gap%</th>
              <th style={{ textAlign: 'center', padding: '5px 6px', color: '#555', fontWeight: 700, fontSize: 10 }}>FVG</th>
              <th style={{ textAlign: 'right', padding: '5px 6px', color: '#1565c0', fontWeight: 700, fontSize: 10 }}>Entry</th>
              <th style={{ textAlign: 'right', padding: '5px 6px', color: '#c62828', fontWeight: 700, fontSize: 10 }}>SL</th>
              <th style={{ textAlign: 'right', padding: '5px 6px', color: '#555', fontWeight: 700, fontSize: 10 }}>SL%</th>
              <th style={{ textAlign: 'right', padding: '5px 6px', color: '#2e7d32', fontWeight: 700, fontSize: 10 }}>T1</th>
              <th style={{ textAlign: 'right', padding: '5px 6px', color: '#2e7d32', fontWeight: 700, fontSize: 10 }}>T2</th>
              <th style={{ textAlign: 'right', padding: '5px 6px', color: '#555', fontWeight: 700, fontSize: 10 }}>RR</th>
            </tr>
          </thead>
          <tbody>
            {obData.slice(0, 12).map(ob => {
              const g = ob.grade || 'D';
              const isDemand = ob.htf_zone_type === 'demand';
              return (
                <tr key={ob.symbol} style={{ borderBottom: '1px solid #f0f0f0', backgroundColor: gradeBg[g] || 'transparent' }}>
                  <td style={{ padding: '5px 6px', textAlign: 'center' }}>
                    <Chip label={g} size="small" sx={{ fontSize: 10, height: 20, fontWeight: 800, minWidth: 28, bgcolor: gradeColor[g], color: '#fff' }} />
                  </td>
                  <td style={{ padding: '5px 6px', fontWeight: 700 }}>{ob.symbol}</td>
                  <td style={{ padding: '5px 6px', textAlign: 'right' }}>{fmtCur(ob.price)}</td>
                  <td style={{ padding: '5px 6px', textAlign: 'center' }}>
                    <span style={{ color: trendColor(ob.htf_trend), fontWeight: 700, fontSize: 10 }}>{ob.htf_trend === 'up' ? '▲' : '▼'} W</span>
                  </td>
                  <td style={{ padding: '5px 6px', textAlign: 'center' }}>
                    <span style={{ color: trendColor(ob.daily_trend), fontWeight: 700, fontSize: 10 }}>{ob.daily_trend === 'up' ? '▲' : '▼'} D</span>
                  </td>
                  <td style={{ padding: '5px 6px', textAlign: 'center', fontSize: 9, fontFamily: 'monospace', letterSpacing: -1 }}>
                    <Tooltip title={`${ob.trend_strength} (${ob.trend_confirms}/3 confirms${ob.daily_ema_aligned ? ', EMA aligned' : ''}${ob.daily_macd_confirms ? ', MACD confirms' : ''})`}>
                      <span style={{ color: ob.trend_strength === 'strong' ? '#1b5e20' : ob.trend_strength === 'moderate' ? '#f57f17' : '#c62828' }}>{strengthIcon(ob.trend_strength)}</span>
                    </Tooltip>
                  </td>
                  <td style={{ padding: '5px 6px', textAlign: 'center' }}>
                    <Chip label={isDemand ? 'DEMAND' : 'SUPPLY'} size="small"
                      sx={{ fontSize: 8, height: 16, fontWeight: 700, bgcolor: isDemand ? '#2e7d32' : '#c62828', color: '#fff' }} />
                  </td>
                  <td style={{ padding: '5px 6px', textAlign: 'right', fontSize: 10, color: isDemand ? '#2e7d32' : '#c62828' }}>
                    {fmtCur(ob.htf_ob_low)} – {fmtCur(ob.htf_ob_high)}
                  </td>
                  <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: (ob.gap_from_ob_pct || 99) <= 5 ? 700 : 400, color: (ob.gap_from_ob_pct || 99) <= 5 ? '#1565c0' : '#888' }}>
                    {fmt(ob.gap_from_ob_pct, 1)}%
                  </td>
                  <td style={{ padding: '5px 6px', textAlign: 'center' }}>
                    {ob.htf_ob_fvg ? <Chip label="FVG" size="small" sx={{ fontSize: 7, height: 14, bgcolor: isDemand ? '#c8e6c9' : '#ffcdd2', color: isDemand ? '#1b5e20' : '#b71c1c', fontWeight: 700 }} /> : '–'}
                  </td>
                  <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 700, color: '#1565c0' }}>{fmtCur(ob.entry)}</td>
                  <td style={{ padding: '5px 6px', textAlign: 'right', color: '#c62828' }}>{fmtCur(ob.stop_loss)}</td>
                  <td style={{ padding: '5px 6px', textAlign: 'right', color: (ob.sl_pct || 0) <= 2 ? '#2e7d32' : (ob.sl_pct || 0) <= 4 ? '#f57f17' : '#c62828', fontWeight: 600 }}>
                    {fmt(ob.sl_pct, 1)}%
                  </td>
                  <td style={{ padding: '5px 6px', textAlign: 'right', color: '#2e7d32', fontWeight: 600 }}>{fmtCur(ob.target_1)}</td>
                  <td style={{ padding: '5px 6px', textAlign: 'right', color: '#2e7d32' }}>{fmtCur(ob.target_2)}</td>
                  <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 700, color: (ob.rr_1 || 0) >= 3 ? '#1b5e20' : (ob.rr_1 || 0) >= 2 ? '#43a047' : '#f57f17' }}>
                    1:{fmt(ob.rr_1, 1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Box>
      <Box sx={{ mt: 1, fontSize: 10, color: '#999', display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
        <span><b>HTF</b>=Weekly OB</span>
        <span><b>D.Trend</b>=Daily SuperTrend+EMA+MACD</span>
        <span><b>Strength</b>: ███=3/3 confirms</span>
        <span>SL at OB edge for tight risk</span>
        <span>Targets via Fib extension</span>
        <span style={{ color: '#1b5e20' }}>A≥8</span>
        <span style={{ color: '#43a047' }}>B≥6</span>
        <span style={{ color: '#f57f17' }}>C≥4</span>
        <span style={{ color: '#c62828' }}>D&lt;4</span>
      </Box>
    </Card>
  );
}

// ─── Sector Heatmap ─────────────────────────────────────────────────────────
function SectorHeatmap({ sectors }) {
  const navigate = useNavigate();
  if (!sectors || !sectors.length) {
    return (
      <Card>
        <SectionTitle>Sector Performance</SectionTitle>
        <Box sx={{ fontSize: 12, color: '#777' }}>
          Sector outlook data is not available from current backend source.
        </Box>
      </Card>
    );
  }
  const data = sectors.filter(s => s.sector && s.avg_day_change != null).sort((a, b) => Math.abs(b.avg_day_change) - Math.abs(a.avg_day_change));
  if (!data.length) {
    return (
      <Card>
        <SectionTitle>Sector Performance</SectionTitle>
        <Box sx={{ fontSize: 12, color: '#777' }}>
          Sector data is available but not in expected format.
        </Box>
      </Card>
    );
  }
  const maxAbs = Math.max(...data.map(d => Math.abs(d.avg_day_change || 0)), 1);

  const heatColor = (v) => {
    const n = +v || 0;
    const intensity = Math.min(Math.abs(n) / maxAbs, 1);
    if (n > 0) return `rgba(46,125,50,${0.15 + intensity * 0.65})`;
    if (n < 0) return `rgba(198,40,40,${0.15 + intensity * 0.65})`;
    return '#f5f5f5';
  };

  return (
    <Card>
      <SectionTitle>Sector Performance</SectionTitle>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 1 }}>
        {data.slice(0, 12).map(s => (
          <Tooltip key={s.sector} title={`${s.sector}: ${s.stock_count || '?'} stocks, Trend: ${s.trend || '—'}`}>
            <Box
              onClick={() => navigate('/outlook')}
              sx={{
                bgcolor: heatColor(s.avg_day_change), borderRadius: 1.5, p: 1.2, cursor: 'pointer', transition: 'transform 0.15s',
                '&:hover': { transform: 'scale(1.03)', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' },
                color: Math.abs(s.avg_day_change || 0) / maxAbs > 0.5 ? '#fff' : '#333',
              }}
            >
              <Box sx={{ fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.sector}</Box>
              <Box sx={{ fontSize: 15, fontWeight: 700 }}>{fmtPct(s.avg_day_change)}</Box>
              <Box sx={{ fontSize: 10, opacity: 0.8 }}>
                {Number.isFinite(Number(s.stock_count)) ? `${Number(s.stock_count)} stocks` : '—'}
              </Box>
            </Box>
          </Tooltip>
        ))}
      </Box>
    </Card>
  );
}

// ─── Market Movers ──────────────────────────────────────────────────────────
function MarketMovers({ gainers, losers }) {
  const navigate = useNavigate();
  const renderList = (items, label, isGainer) => (
    <Box>
      <Box sx={{ fontSize: 12, fontWeight: 600, color: isGainer ? '#2e7d32' : '#c62828', mb: 0.5 }}>{label}</Box>
      {items.slice(0, 5).map((s, i) => (
        <Box key={s.symbol || i} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5, borderBottom: '1px solid #f5f5f5', fontSize: 12 }}>
          <Box sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <span style={{ color: '#999', width: 16, display: 'inline-block' }}>{i + 1}.</span>
            {s.symbol}
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
            <span style={{ color: '#555' }}>{s.cmp}</span>
            <span style={{ color: isGainer ? '#2e7d32' : '#c62828', fontWeight: 700, minWidth: 60, textAlign: 'right' }}>{s.chg}</span>
          </Box>
        </Box>
      ))}
    </Box>
  );

  return (
    <Card>
      <SectionTitle action={<Chip label="View All" size="small" sx={{ fontSize: 10, cursor: 'pointer' }} onClick={() => navigate('/screens')} />}>
        Market Movers
      </SectionTitle>
      {!gainers?.length && !losers?.length ? (
        <Box sx={{ fontSize: 12, color: '#777' }}>
          Market movers data is currently unavailable.
        </Box>
      ) : null}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, '@media (max-width: 700px)': { gridTemplateColumns: '1fr' } }}>
        {renderList(gainers, 'Top Gainers', true)}
        {renderList(losers, 'Top Losers', false)}
      </Box>
    </Card>
  );
}

// ─── Recent Alerts ──────────────────────────────────────────────────────────
function RecentAlerts({ alerts }) {
  const navigate = useNavigate();
  if (!alerts || !alerts.length) {
    return (
      <Card>
        <SectionTitle action={<Chip label="View All" size="small" sx={{ fontSize: 10, cursor: 'pointer' }} onClick={() => navigate('/alerts')} />}>
          Recent Alerts
        </SectionTitle>
        <Box sx={{ fontSize: 12, color: '#777' }}>
          No recent advisor alerts found.
        </Box>
      </Card>
    );
  }
  const sevColor = { critical: '#c62828', high: '#e65100', medium: '#f57f17', low: '#2e7d32', info: '#1565c0' };
  return (
    <Card>
      <SectionTitle action={<Chip label="View All" size="small" sx={{ fontSize: 10, cursor: 'pointer' }} onClick={() => navigate('/alerts')} />}>
        Recent Alerts
      </SectionTitle>
      {alerts.slice(0, 6).map((a, i) => (
        <Box key={a.id || i} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', py: 0.7, borderBottom: '1px solid #f5f5f5', fontSize: 12 }}>
          <Chip label={a.severity || 'info'} size="small" sx={{ fontSize: 9, height: 18, fontWeight: 700, bgcolor: sevColor[a.severity] || '#888', color: '#fff', flexShrink: 0 }} />
          <Box>
            <span style={{ fontWeight: 600 }}>{a.symbol}</span>{' '}
            <span style={{ color: '#555' }}>{a.message?.substring(0, 80)}{a.message?.length > 80 ? '…' : ''}</span>
          </Box>
        </Box>
      ))}
    </Card>
  );
}

function TrendingStocksPanel({ alerts, trendingStocks = [] }) {
  const earlyRows = (Array.isArray(alerts) ? alerts : [])
    .filter((a) => String(a?.alert_type || '').toLowerCase().startsWith('entry_early_'))
    .sort((a, b) => new Date(b?.timestamp || 0).getTime() - new Date(a?.timestamp || 0).getTime());

  const symbolRows = useMemo(() => {
    const bySymbol = new Map();
    earlyRows.forEach((r) => {
      const symbol = String(r?.symbol || '').trim().toUpperCase();
      if (!symbol) return;
      if (!bySymbol.has(symbol)) bySymbol.set(symbol, { kind: 'alert', ...r });
    });
    if (bySymbol.size) return [...bySymbol.values()].slice(0, 20);

    (Array.isArray(trendingStocks) ? trendingStocks : []).forEach((s) => {
      const symbol = String(s?.symbol || '').trim().toUpperCase();
      if (!symbol || bySymbol.has(symbol)) return;
      bySymbol.set(symbol, { kind: 'trend', symbol, chg: s.chg, cmp: s.cmp });
    });
    return [...bySymbol.values()].slice(0, 20);
  }, [earlyRows, trendingStocks]);

  const usingTrendFallback = !earlyRows.length && symbolRows.length > 0;

  if (!symbolRows.length) {
    return (
      <Card>
        <SectionTitle>Trending Stocks (Early Entry)</SectionTitle>
        <Box sx={{ fontSize: 12, color: '#777' }}>
          No trending stocks yet. Stocks will appear here when ENTRY_EARLY conditions are met.
        </Box>
      </Card>
    );
  }

  return (
    <Card>
      <SectionTitle>Trending Stocks (Early Entry)</SectionTitle>
      <Box sx={{ fontSize: 11, color: '#666', mb: 1 }}>
        {usingTrendFallback
          ? 'Top momentum names by 1-day change (ENTRY_EARLY alerts will replace when live conditions fire).'
          : 'Live list from ENTRY_EARLY conditions (accepted breakout with volume confirmation).'}
      </Box>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {symbolRows.map((a, i) => {
          if (a.kind === 'trend') {
            const chgNum = parsePctNumber(a.chg);
            const isUp = chgNum == null || chgNum >= 0;
            return (
              <Chip
                key={`${a.symbol}_${i}`}
                label={`${a.symbol} ${a.chg || ''}`}
                size="small"
                sx={{
                  fontWeight: 700,
                  bgcolor: isUp ? '#e8f5e9' : '#ffebee',
                  color: isUp ? '#1b5e20' : '#b71c1c',
                  border: `1px solid ${isUp ? '#81c784' : '#ef9a9a'}`,
                }}
                title={a.cmp ? `CMP ${a.cmp}` : ''}
              />
            );
          }
          const t = String(a?.alert_type || '').toLowerCase();
          const isUp = t.includes('_up_');
          return (
            <Chip
              key={`${a.symbol}_${i}`}
              label={`${a.symbol} ${isUp ? '▲' : '▼'}`}
              size="small"
              sx={{
                fontWeight: 700,
                bgcolor: isUp ? '#e8f5e9' : '#ffebee',
                color: isUp ? '#1b5e20' : '#b71c1c',
                border: `1px solid ${isUp ? '#81c784' : '#ef9a9a'}`,
              }}
              title={a.message || ''}
            />
          );
        })}
      </Box>
    </Card>
  );
}

// ─── AI Ratings Summary ─────────────────────────────────────────────────────
function LatestRatings({ ratings }) {
  const navigate = useNavigate();
  if (!ratings || !ratings.length) {
    return (
      <Card>
        <SectionTitle action={<Chip label="View All" size="small" sx={{ fontSize: 10, cursor: 'pointer' }} onClick={() => navigate('/advisor')} />}>
          Latest AI Ratings
        </SectionTitle>
        <Box sx={{ fontSize: 12, color: '#777' }}>
          No AI ratings available right now.
        </Box>
      </Card>
    );
  }
  const recoColors = { 'STRONG BUY': '#1b5e20', 'BUY': '#43a047', 'HOLD': '#f57f17', 'SELL': '#c62828', 'STRONG SELL': '#b71c1c' };
  return (
    <Card>
      <SectionTitle action={<Chip label="View All" size="small" sx={{ fontSize: 10, cursor: 'pointer' }} onClick={() => navigate('/advisor')} />}>
        Latest AI Ratings
      </SectionTitle>
      {ratings.slice(0, 5).map((r, i) => (
        <Box key={r.symbol || i} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.7, borderBottom: '1px solid #f5f5f5', fontSize: 12 }}>
          <Box sx={{ fontWeight: 700, width: 90 }}>{r.symbol}</Box>
          <Chip label={String(r.recommendation || '').toUpperCase()} size="small" sx={{ fontSize: 9, height: 18, fontWeight: 700, bgcolor: recoColors[String(r.recommendation || '').toUpperCase()] || '#888', color: '#fff', minWidth: 60 }} />
          <Box sx={{ flex: 1, color: '#555' }}>Score: <b>{fmt(r.composite_score, 0)}</b></Box>
          {r.entry_price && <Box sx={{ color: '#555' }}>Entry: {fmtCur(r.entry_price)}</Box>}
          {r.target_short_term && <Box sx={{ color: '#2e7d32' }}>T: {fmtCur(r.target_short_term)}</Box>}
        </Box>
      ))}
    </Card>
  );
}

const holdingAvgPrice = (h) => {
  const n = Number(h?.avg_price ?? h?.avgPrice ?? h?.buyAvg ?? h?.averagePrice ?? h?.avgCostPrice);
  return Number.isFinite(n) && n > 0 ? n : null;
};
const holdingLtp = (h) => {
  const n = Number(h?.ltp ?? h?.lastPrice ?? h?.lastTradedPrice);
  return Number.isFinite(n) && n > 0 ? n : null;
};
const holdingQty = (h) => {
  const n = Number(h?.net_qty ?? h?.netQty ?? h?.totalQty ?? h?.quantity);
  return Number.isFinite(n) ? n : 0;
};
const holdingPnlAmount = (h) => {
  const direct = Number(h?.unrealized_pnl ?? h?.unrealizedPnl ?? h?.pnl);
  if (Number.isFinite(direct) && direct !== 0) return direct;
  const avg = holdingAvgPrice(h);
  const ltp = holdingLtp(h);
  const qty = holdingQty(h);
  if (avg != null && ltp != null && qty !== 0) return (ltp - avg) * qty;
  return Number.isFinite(direct) ? direct : null;
};
const holdingPnlPctFromAvg = (h) => {
  const cached = Number(h?.pnl_pct ?? h?.pnlPct);
  if (Number.isFinite(cached)) return cached;
  const avg = holdingAvgPrice(h);
  const ltp = holdingLtp(h);
  if (avg != null && ltp != null) return ((ltp - avg) / avg) * 100;
  const pnl = holdingPnlAmount(h);
  const qty = holdingQty(h);
  if (avg != null && qty !== 0 && pnl != null) return (pnl / (avg * Math.abs(qty))) * 100;
  return null;
};

// ─── My Holdings (Broker Session) ───────────────────────────────────────────
function HoldingsList({ holdings, loading, brokerAuthenticated, compact = false }) {
  if (!brokerAuthenticated) {
    return (
      <Card>
        <SectionTitle>My Holdings</SectionTitle>
        <Box sx={{ fontSize: 12, color: '#777' }}>
          Broker authentication is required. Please complete broker session authentication in Profile to view holdings.
        </Box>
      </Card>
    );
  }

  if (loading && !holdings.length) {
    return (
      <Card>
        <SectionTitle>My Holdings</SectionTitle>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={24} />
        </Box>
      </Card>
    );
  }

  if (!holdings.length) {
    return (
      <Card>
        <SectionTitle>My Holdings</SectionTitle>
        <Box sx={{ fontSize: 12, color: '#777' }}>
          No holdings found yet. Create broker session token in Profile and place/execute orders to see holdings here.
        </Box>
      </Card>
    );
  }

  const totalUnrealized = holdings.reduce((sum, h) => sum + Number(h?.unrealized_pnl || 0), 0);
  const totalRealized = holdings.reduce((sum, h) => sum + Number(h?.realized_pnl || 0), 0);
  const totalHoldingsPnl = totalUnrealized + totalRealized;
  const dayPnl = holdings.reduce(
    (sum, h) => sum + Number(h?.day_pnl ?? h?.mtm ?? h?.unrealized_pnl ?? 0),
    0
  );

  const visibleRows = holdings;
  return (
    <Card sx={compact ? { p: 1.5 } : undefined}>
      <SectionTitle
        action={
          <Box sx={{ display: 'flex', gap: 0.6, flexWrap: 'wrap' }}>
            <Chip
              label={`Total Holdings P&L: ${fmtCur(totalHoldingsPnl)}`}
              size="small"
              sx={{ bgcolor: '#f5f5f5', color: pctColor(totalHoldingsPnl), fontWeight: 700 }}
            />
            <Chip
              label={`Day P&L: ${fmtCur(dayPnl)}`}
              size="small"
              sx={{ bgcolor: '#f5f5f5', color: pctColor(dayPnl), fontWeight: 700 }}
            />
          </Box>
        }
      >
        My Holdings ({holdings.length})
      </SectionTitle>
      <Box sx={{ overflowX: 'auto', maxHeight: compact ? 360 : 'none', overflowY: compact ? 'auto' : 'visible' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: compact ? 11 : 12 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: '#555', fontWeight: 600 }}>Symbol</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', color: '#555', fontWeight: 600 }}>Qty</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', color: '#555', fontWeight: 600 }}>Avg</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', color: '#555', fontWeight: 600 }}>LTP</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', color: '#555', fontWeight: 600 }}>P&L</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', color: '#555', fontWeight: 600 }}>P&L %</th>
              {!compact ? <th style={{ textAlign: 'center', padding: '6px 8px', color: '#555', fontWeight: 600 }}>State</th> : null}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((h, idx) => (
              <tr key={`${h.symbol || h.tradingSymbol || idx}_${h.product_type || 'row'}`} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '6px 8px', fontWeight: 700 }}>
                  {h.symbol || h.tradingSymbol || h.symbolName || h.scripName || '—'}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmt(h.net_qty ?? h.netQty ?? h.totalQty ?? h.quantity, 0)}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmtCur(holdingAvgPrice(h))}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmtCur(holdingLtp(h))}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: pctColor(holdingPnlAmount(h)) }}>
                  {fmtCur(holdingPnlAmount(h))}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: pctColor(holdingPnlPctFromAvg(h)) }}>
                  {fmtPct(holdingPnlPctFromAvg(h))}
                </td>
                {!compact ? (
                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                    <Chip
                      label={(h.state || 'OPEN').toUpperCase()}
                      size="small"
                      sx={{
                        fontSize: 9,
                        height: 18,
                        fontWeight: 700,
                        bgcolor: (h.state || '').toLowerCase() === 'open' ? '#e8f5e9' : '#f5f5f5',
                        color: (h.state || '').toLowerCase() === 'open' ? '#1b5e20' : '#555',
                      }}
                    />
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </Box>
    </Card>
  );
}

// ─── Main Dashboard ─────────────────────────────────────────────────────────
function DashboardPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, isAuthenticated, accessToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [indices, setIndices] = useState(null);
  const [watchlist, setWatchlist] = useState([]);
  const [signals, setSignals] = useState([]);
  const [weeklyData, setWeeklyData] = useState([]);
  const [advisorRegimeStocks, setAdvisorRegimeStocks] = useState([]);
  const [obData, setObData] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [gainers, setGainers] = useState([]);
  const [losers, setLosers] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [trendingStocks, setTrendingStocks] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [marketMode, setMarketMode] = useState('unknown');
  const [holdings, setHoldings] = useState([]);
  const [brokerAuthenticated, setBrokerAuthenticated] = useState(false);
  const [telegramStatusChecked, setTelegramStatusChecked] = useState(false);
  const [hasApprovedTelegramAccess, setHasApprovedTelegramAccess] = useState(false);
  const userId = String(user?.id || user?.user_id || user?.email || '');
  const loadSeqRef = useRef(0);
  const hasHydratedData = Boolean(
    (watchlist && watchlist.length)
    || (signals && signals.length)
    || (weeklyData && weeklyData.length)
    || (advisorRegimeStocks && advisorRegimeStocks.length)
    || (obData && obData.length)
    || (sectors && sectors.length)
    || (gainers && gainers.length)
    || (losers && losers.length)
    || (alerts && alerts.length)
    || (ratings && ratings.length)
    || (trendingStocks && trendingStocks.length)
    || indices
  );

  const refreshBrokerHoldings = useCallback(async ({ forceLive = false } = {}) => {
    if (!userId) {
      setBrokerAuthenticated(false);
      setHoldings([]);
      return;
    }
    const broker = await resolveDashboardBrokerHoldings(userId, { forceLive });
    setBrokerAuthenticated(broker.authenticated);
    setHoldings(broker.rows);
  }, [userId]);

  const loadAll = useCallback(async ({ forceSpinner = false, forceRefresh = false, backgroundOnly = false } = {}) => {
    const loadSeq = ++loadSeqRef.current;
    const isStaleLoad = () => loadSeq !== loadSeqRef.current;
    try {
      if (!isAuthenticated || !accessToken) {
        setLoadError('Your session expired. Please sign in again.');
        setLoading(false);
        return;
      }
      if (forceSpinner && !hasHydratedData && !backgroundOnly) {
        setLoading(true);
      }
      const session = await ensureMarketSession();
      ensureLegacyFormattedScreenCachesPurged();
      const liveSession = shouldPollLiveMarket(session);
      const cachedWrap = readPageCache(DASHBOARD_CACHE_KEY);
      const cached = cachedWrap?.data || null;
      const cacheStale = forceRefresh || isPageCacheStale(cachedWrap?.updatedAt, session);
      const cacheIncomplete = isDashboardCacheIncomplete(cached);

      if (cached && !forceRefresh) {
        applyDashboardCache({
          setIndices,
          setWatchlist,
          setSignals,
          setWeeklyData,
          setAdvisorRegimeStocks,
          setObData,
          setSectors,
          setGainers,
          setLosers,
          setAlerts,
          setRatings,
          setTrendingStocks,
          setMarketMode,
          setLastUpdated,
        }, { ...cached, updatedAt: cachedWrap?.updatedAt }, marketMode);
        if (!backgroundOnly) setLoading(false);
      }

      const refreshFallback = buildDashboardRefreshFallback(cachedWrap?.data ? cachedWrap : cached);
      const need = dashboardSectionsToRefresh({ ...refreshFallback, ...cached });
      applyLiveSessionRefreshPolicy(need, liveSession);
      if (forceRefresh) applyPullRefreshPolicy(need);

      if (!forceRefresh && !liveSession && !cacheStale && !cacheIncomplete && cached) {
        const skipNetwork = await shouldUseCachedPageDataOnly(DASHBOARD_CACHE_KEY);
        if (skipNetwork) {
          await refreshBrokerHoldings({ forceLive: true });
          return;
        }
      }

      if (backgroundOnly && !cached) {
        return;
      }

      if (liveSession || forceRefresh || cacheStale) {
        clearApiGetCache();
        if (cacheStale || forceRefresh) clearPageCache(DASHBOARD_CACHE_KEY);
      }

      const skipApiCache = liveSession || forceRefresh;
      const partial = { ...refreshFallback, ...cached };
      const sectionFallback = () => ({ ...refreshFallback, ...partial });

      const phase1 = await Promise.allSettled([
        need.indices || forceRefresh ? fetchMarketIndices() : Promise.resolve(partial.indices || null),
        need.movers || forceRefresh
          ? fetchPriceShockersRaw('gainers', 8, 'day').then((rows) => mapPriceShockersList(rows, 'day'))
          : Promise.resolve(partial.gainers ?? []),
        need.movers || forceRefresh
          ? fetchPriceShockersRaw('losers', 8, 'day').then((rows) => mapPriceShockersList(rows, 'day'))
          : Promise.resolve(partial.losers ?? []),
      ]);
      if (isStaleLoad()) return;
      partial.indices = settledValue(phase1[0], partial.indices || null);
      partial.gainers = pickDashboardSectionRows('gainers', settledValue(phase1[1], null), sectionFallback());
      partial.losers = pickDashboardSectionRows('losers', settledValue(phase1[2], null), sectionFallback());
      setIndices(partial.indices);
      setGainers(Array.isArray(partial.gainers) ? partial.gainers : []);
      setLosers(Array.isArray(partial.losers) ? partial.losers : []);

      const phase2 = await Promise.allSettled([
        need.watchlist || forceRefresh
          ? fetchWatchlist(null, skipApiCache ? { skipCache: true } : {})
          : Promise.resolve(partial.watchlist ?? []),
        need.extras || forceRefresh ? fetchWatchlistSignals({ timeframe: 'intraday' }) : Promise.resolve(partial.signals ?? []),
        need.extras || forceRefresh ? fetchAdvisorWeeklyEntries({ limit: 25, max_entry_gap_pct: 5 }) : Promise.resolve(partial.weeklyData ?? []),
        need.extras || forceRefresh ? fetchAlerts({ limit: 25 }) : Promise.resolve(partial.alerts ?? []),
        need.extras || forceRefresh ? fetchRatings({ limit: 8 }) : Promise.resolve(partial.ratings ?? []),
        need.extras || forceRefresh
          ? fetchTrendingRaw(20).then((rows) => mapStockListToTable(rows, {}))
          : Promise.resolve(partial.trendingStocks ?? []),
      ]);
      if (isStaleLoad()) return;
      partial.watchlist = pickDashboardSectionRows('watchlist', settledValue(phase2[0], null), sectionFallback());
      partial.signals = pickDashboardSectionRows('signals', settledValue(phase2[1], null), sectionFallback());
      partial.weeklyData = dedupeWeeklyEntriesBySymbol(
        pickDashboardSectionRows('weeklyData', settledValue(phase2[2], null), sectionFallback()),
      );
      partial.alerts = pickDashboardSectionRows('alerts', settledValue(phase2[3], null), sectionFallback());
      partial.ratings = pickDashboardSectionRows('ratings', settledValue(phase2[4], null), sectionFallback());
      partial.trendingStocks = pickDashboardSectionRows('trendingStocks', settledValue(phase2[5], null), sectionFallback());

      setWatchlist(Array.isArray(partial.watchlist) ? partial.watchlist : []);
      setSignals(Array.isArray(partial.signals) ? partial.signals : []);
      setWeeklyData(Array.isArray(partial.weeklyData) ? partial.weeklyData : []);
      setAlerts(Array.isArray(partial.alerts) ? partial.alerts : []);
      setRatings(Array.isArray(partial.ratings) ? partial.ratings : []);
      setTrendingStocks(Array.isArray(partial.trendingStocks) ? partial.trendingStocks : []);
      if (!backgroundOnly) setLoading(false);

      const phase3 = await Promise.allSettled([
        need.extras || forceRefresh ? fetchSectorOutlook() : Promise.resolve(partial.sectors ?? []),
        need.extras || forceRefresh ? fetchOrderBlocks() : Promise.resolve(partial.obData ?? []),
        need.extras || forceRefresh ? fetchLatestSignalsPayload(200) : Promise.resolve({ data: partial.advisorRegimeStocks ?? [] }),
        apiGet('/system/status'),
      ]);
      if (isStaleLoad()) return;
      partial.sectors = pickDashboardSectionRows('sectors', settledValue(phase3[0], null), sectionFallback());
      partial.obData = pickDashboardSectionRows('obData', settledValue(phase3[1], null), sectionFallback());
      const advPayload = settledValue(phase3[2], { data: partial.advisorRegimeStocks ?? [] });
      const freshAdvisorRows = Array.isArray(advPayload?.data) ? advPayload.data : [];
      partial.advisorRegimeStocks = freshAdvisorRows.length
        ? freshAdvisorRows.map((s) => ({
          symbol: s.symbol,
          day1d: s.day1d,
          day1w: s.week1w,
        }))
        : (Array.isArray(refreshFallback.advisorRegimeStocks) ? refreshFallback.advisorRegimeStocks : []);
      const sys = phase3[3];

      const coreResults = [phase1[0], phase2[0], phase2[1], phase2[2], phase3[2], phase3[0], phase1[1], phase1[2], phase2[3], phase2[4], phase2[5]];
      const fulfilledCount = coreResults.filter((r) => r.status === 'fulfilled').length;
      const allAuthRejected = fulfilledCount === 0
        && coreResults.every(
          (r) => r.status === 'rejected' && isAuthFailureMessage(r.reason?.message),
        );
      if (allAuthRejected) {
        setLoadError('Your session expired. Please sign in again to load dashboard data.');
        setLoading(false);
        return;
      }

      setAdvisorRegimeStocks(Array.isArray(partial.advisorRegimeStocks) ? partial.advisorRegimeStocks : []);
      setObData(Array.isArray(partial.obData) ? partial.obData : []);
      setSectors(Array.isArray(partial.sectors) ? partial.sectors : []);
      if (sys.status === 'fulfilled') setMarketMode(sys.value?.orchestrator?.mode || 'unknown');
      setLastUpdated(new Date());
      setLoadError('');
      if (
        hasDashboardWatchlist(partial)
        || hasDashboardWatchlist(refreshFallback)
        || hasDashboardIndices(partial)
        || hasDashboardMovers(partial)
      ) {
        writePageCache(DASHBOARD_CACHE_KEY, {
          indices: partial.indices,
          watchlist: partial.watchlist,
          signals: partial.signals,
          weeklyData: partial.weeklyData,
          advisorRegimeStocks: partial.advisorRegimeStocks,
          obData: partial.obData,
          sectors: partial.sectors,
          gainers: partial.gainers,
          losers: partial.losers,
          alerts: partial.alerts,
          ratings: partial.ratings,
          trendingStocks: partial.trendingStocks,
          marketMode: sys.status === 'fulfilled' ? (sys.value?.orchestrator?.mode || 'unknown') : marketMode,
        });
      }
      setLoading(false);

      await refreshBrokerHoldings({ forceLive: true });
    } finally {
      setLoading(false);
    }
  }, [hasHydratedData, marketMode, refreshBrokerHoldings, isAuthenticated, accessToken]);

  useEffect(() => {
    LEGACY_DASHBOARD_CACHE_KEYS.forEach((key) => clearPageCache(key));
  }, []);

  useEffect(() => {
    let timer;
    let cancelled = false;
    (async () => {
      await loadAll({ forceSpinner: true });
      if (cancelled) return;
      const session = await ensureMarketSession();
      const pollMs = getMarketPollingIntervalMs(30_000, 0);
      if (pollMs > 0 && session.isLiveMarket) {
        timer = setInterval(() => loadAll({ forceSpinner: false, backgroundOnly: true }), pollMs);
      }
    })();
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [loadAll, marketMode]);

  useEffect(() => {
    if (!userId) return undefined;
    let timer;
    let cancelled = false;
    (async () => {
      const session = await ensureMarketSession();
      if (cancelled) return;
      const tick = async () => {
        if (cancelled) return;
        await refreshBrokerHoldings({ forceLive: true });
      };
      await tick();
      const pollMs = session.isMarketHours && session.isTradingDay ? 30000 : 120000;
      timer = setInterval(tick, pollMs);
    })();
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [userId, refreshBrokerHoldings]);

  useEffect(() => {
    if (location.state?.brokerConsentLimited) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    let mounted = true;
    const checkTelegramStatus = async () => {
      try {
        const rows = await fetchTelegramSubscribers({ activeOnly: true, approvedOnly: true });
        const userId = Number(user?.id);
        const mobile = normalizeMobile(user?.mobile);
        const approved = (rows || []).some((row) => {
          if (!row?.is_approved) return false;
          if (row.is_identity_verified === false) return false;
          const sameUserId =
            Number.isFinite(userId) && row?.linked_user_id != null && Number(row.linked_user_id) === userId;
          const sameMobile =
            Boolean(mobile) && row?.linked_mobile && normalizeMobile(row.linked_mobile) === mobile;
          return Boolean(sameUserId || sameMobile);
        });
        if (mounted) setHasApprovedTelegramAccess(approved);
      } catch (_) {
        if (mounted) setHasApprovedTelegramAccess(false);
      } finally {
        if (mounted) setTelegramStatusChecked(true);
      }
    };
    checkTelegramStatus();
    return () => {
      mounted = false;
    };
  }, [user?.id, user?.mobile]);

  return (
    <Box sx={{ width: '100%', px: { xs: 1, sm: 2, md: 3 }, py: { xs: 1, md: 2 }, boxSizing: 'border-box' }}>
      {loadError ? (
        <Alert
          severity="warning"
          sx={{ mb: 2 }}
          action={(
            <Button color="inherit" size="small" onClick={() => navigate('/login', { state: { from: '/' } })}>
              Sign in
            </Button>
          )}
        >
          {loadError}
        </Alert>
      ) : null}

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ fontWeight: 700, fontSize: 22, color: '#1a3c5e' }}>Dashboard</Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {lastUpdated && <Box sx={{ fontSize: 11, color: '#999' }}>Updated {lastUpdated.toLocaleTimeString()}</Box>}
          <IconButton size="small" onClick={() => loadAll({ forceSpinner: !hasHydratedData, forceRefresh: true })} disabled={loading && !hasHydratedData}>
            <MdRefresh size={18} />
          </IconButton>
        </Box>
      </Box>

      {loading && !lastUpdated ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : (
        <>
          {location.state?.showTelegramBotInfo ? (
            <Alert severity="success" sx={{ mb: 2 }}>
              You&apos;re signed in. To receive market alerts in Telegram, open{' '}
              <a href={TELEGRAM_BOT_URL} target="_blank" rel="noreferrer">{TELEGRAM_BOT_LABEL}</a>
              , tap <b>Start</b>, then an administrator can approve your chat in Telegram Admin.
            </Alert>
          ) : null}
          {location.state?.brokerConsentLimited ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              Broker consent login limit reached for today. Dashboard loaded in normal mode; broker reconnect will be attempted on next login day.
            </Alert>
          ) : null}
          {!isAdmin && telegramStatusChecked && !hasApprovedTelegramAccess ? (
            <Alert
              severity="info"
              sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}
              action={
                <Button
                  size="small"
                  variant="contained"
                  href={TELEGRAM_BOT_URL}
                  target="_blank"
                  rel="noreferrer"
                  sx={{ textTransform: 'none', fontWeight: 700 }}
                >
                  Enable Telegram Alerts
                </Button>
              }
            >
              After login, subscribe for alerts: open the bot and send <b>/start</b>. Your chat must be approved in Telegram Admin before alerts are delivered.
            </Alert>
          ) : null}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'minmax(0,1fr) minmax(300px,360px)' }, gap: 2, alignItems: 'start' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <PortfolioSnapshot watchlist={watchlist} signals={signals} weeklyData={weeklyData} />
              <RelativeRegimeBoard stocks={advisorRegimeStocks} indices={indices} />
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1fr 1fr' }, gap: 2 }}>
                <WeeklyEntries weeklyData={weeklyData} />
                <OrderBlockZones obData={obData} />
              </Box>
              <SectorHeatmap sectors={sectors} />
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, '@media (max-width: 800px)': { gridTemplateColumns: '1fr' } }}>
                <MarketMovers gainers={gainers} losers={losers} />
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TrendingStocksPanel alerts={alerts} trendingStocks={trendingStocks} />
                  <LatestRatings ratings={ratings} />
                  <RecentAlerts alerts={alerts} />
                </Box>
              </Box>
            </Box>
            <Box sx={{ position: { xl: 'sticky' }, top: { xl: 16 }, minWidth: 0 }}>
              <HoldingsList holdings={holdings} loading={loading} brokerAuthenticated={brokerAuthenticated} compact />
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
}

export default DashboardPage;
