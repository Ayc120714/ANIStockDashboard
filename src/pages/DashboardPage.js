import React, { useState, useEffect, useCallback } from 'react';
import { Box, Chip, CircularProgress, Tooltip, IconButton } from '@mui/material';
import { MdRefresh, MdTrendingUp, MdTrendingDown, MdRemoveRedEye } from 'react-icons/md';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RTooltip } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { fetchWatchlist, fetchWatchlistSignals, fetchWeeklyIndicators, fetchOrderBlocks } from '../api/watchlist';
import { fetchMarketIndices } from '../api/marketIndices';
import { fetchSectorOutlook } from '../api/sectorOutlook';
import { fetchPriceShockers } from '../api/stocks';
import { fetchAlerts, fetchRatings } from '../api/advisor';

const COLORS_PIE = ['#1a3c5e', '#2e7d32', '#c62828', '#f57f17', '#6a1b9a', '#00838f', '#4e342e', '#37474f', '#e65100', '#1565c0'];
const fmt = (v, d = 2) => { if (v == null) return '—'; const n = +v; return isNaN(n) ? '—' : n.toFixed(d); };
const fmtPct = (v) => { if (v == null) return '—'; const n = +v; return isNaN(n) ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`; };
const fmtCur = (v) => { if (v == null) return '—'; const n = +v; return isNaN(n) ? '—' : `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; };
const pctColor = (v) => { const n = +v; if (isNaN(n) || n === 0) return '#666'; return n > 0 ? '#2e7d32' : '#c62828'; };

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

// ─── Market Pulse ───────────────────────────────────────────────────────────
function MarketPulse({ indices }) {
  const allCards = [...(indices?.indexCards || []), ...(indices?.smallcapCards || [])];
  if (!allCards.length) return null;
  return (
    <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
      {allCards.map((c, i) => (
        <Card key={i} sx={{ minWidth: 150, flex: '1 1 0', p: 1.5, borderLeft: `3px solid ${c.trendDirection === 'up' ? '#2e7d32' : c.trendDirection === 'down' ? '#c62828' : '#888'}` }}>
          <Box sx={{ fontSize: 11, fontWeight: 600, color: '#555', mb: 0.5, whiteSpace: 'nowrap' }}>{c.title}</Box>
          <Box sx={{ fontSize: 17, fontWeight: 700, color: '#1a3c5e' }}>{c.value}</Box>
          <Box sx={{ fontSize: 12, fontWeight: 600, color: pctColor(c.change?.replace(/[+%]/g, '')) }}>{c.change}</Box>
          {c.pe && <Box sx={{ fontSize: 10, color: '#999', mt: 0.3 }}>{c.pe}</Box>}
        </Card>
      ))}
    </Box>
  );
}

// ─── Portfolio Snapshot ─────────────────────────────────────────────────────
function PortfolioSnapshot({ watchlist, signals, weeklyData }) {
  const navigate = useNavigate();
  const all = watchlist || [];
  const weekly = weeklyData || [];
  const stCount = all.filter(w => w.list_type === 'short_term').length;
  const ltCount = all.filter(w => w.list_type === 'long_term').length;

  const gainers = all.filter(w => w.day1d > 0);
  const losers = all.filter(w => w.day1d < 0);
  const avg1d = all.length ? all.reduce((s, w) => s + (w.day1d || 0), 0) / all.length : 0;

  const best = all.reduce((b, w) => (!b || (w.day1d || 0) > (b.day1d || 0)) ? w : b, null);
  const worst = all.reduce((w2, w) => (!w2 || (w.day1d || 0) < (w2.day1d || 0)) ? w : w2, null);

  const sectorMap = {};
  all.forEach(w => { const s = w.sector || 'Other'; sectorMap[s] = (sectorMap[s] || 0) + 1; });
  const sectorData = Object.entries(sectorMap).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));

  const recoMap = {};
  all.forEach(w => { if (w.recommendation) { const k = w.recommendation.toUpperCase(); recoMap[k] = (recoMap[k] || 0) + 1; } });
  const recoOrder = ['STRONG BUY', 'BUY', 'HOLD', 'SELL', 'STRONG SELL'];
  const recoData = recoOrder.filter(k => recoMap[k]).map(name => ({ name, value: recoMap[name] }));
  Object.keys(recoMap).filter(k => !recoOrder.includes(k)).forEach(k => recoData.push({ name: k, value: recoMap[k] }));
  const recoColors = { 'STRONG BUY': '#1b5e20', 'BUY': '#43a047', 'HOLD': '#f57f17', 'SELL': '#c62828', 'STRONG SELL': '#b71c1c', 'NEAR ENTRY': '#1565c0' };

  const sigArr = signals || [];
  const bullish = sigArr.filter(s => s.signal_score > 25).length;
  const bearish = sigArr.filter(s => s.signal_score < -25).length;
  const overbought = sigArr.filter(s => s.rsi > 70).length;
  const oversold = sigArr.filter(s => s.rsi < 30).length;
  const avgScore = all.length ? all.reduce((s, w) => s + (w.composite_score || 0), 0) / all.filter(w => w.composite_score).length : 0;

  const nearTarget = all.filter(w => w.price && w.target_short_term && Math.abs(w.price - w.target_short_term) / w.target_short_term < 0.05);
  const nearSL = all.filter(w => w.price && w.stop_loss && Math.abs(w.price - w.stop_loss) / w.stop_loss < 0.05);
  const nearEntry = weekly.filter(w => w.near_entry && (w.weekly_entry_gap_pct || 100) <= 10);
  const inEntryZone = weekly.filter(w => (w.weekly_entry_gap_pct || 100) <= 5);

  const topMovers = [...all].sort((a, b) => Math.abs(b.day1d || 0) - Math.abs(a.day1d || 0)).slice(0, 6);

  if (!all.length) return (
    <Card sx={{ textAlign: 'center', py: 4, color: '#888' }}>
      No stocks in watchlist. Add stocks from <b>Short Term</b> or <b>Long Term</b> pages.
    </Card>
  );

  return (
    <Card>
      <SectionTitle icon={<MdRemoveRedEye />} action={
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Chip label={`${stCount} Short Term`} size="small" sx={{ bgcolor: '#e3f2fd', fontWeight: 600, fontSize: 11 }} onClick={() => navigate('/short-term')} />
          <Chip label={`${ltCount} Long Term`} size="small" sx={{ bgcolor: '#fce4ec', fontWeight: 600, fontSize: 11 }} onClick={() => navigate('/long-term')} />
        </Box>
      }>Portfolio Snapshot ({all.length} stocks)</SectionTitle>

      {/* Row 1: Key metrics */}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2, justifyContent: 'space-around', bgcolor: '#f8f9fa', borderRadius: 1.5, py: 1.5 }}>
        <StatBox label="Avg 1D Return" value={fmtPct(avg1d)} color={pctColor(avg1d)} />
        <StatBox label="Advance" value={gainers.length} color="#2e7d32" sub={`of ${all.length}`} />
        <StatBox label="Decline" value={losers.length} color="#c62828" sub={`of ${all.length}`} />
        <StatBox label="Avg Score" value={avgScore ? fmt(avgScore, 0) : '—'} color={avgScore > 60 ? '#2e7d32' : avgScore > 40 ? '#f57f17' : '#c62828'} sub="/100" />
        <StatBox label="Bullish" value={bullish} color="#2e7d32" sub={`/ ${sigArr.length} signals`} />
        <StatBox label="Bearish" value={bearish} color="#c62828" sub={`/ ${sigArr.length} signals`} />
        <StatBox label="Near Entry" value={nearEntry.length} color="#1565c0" sub={`≤10% gap`} />
      </Box>

      {/* Row 2: Best/Worst + Alerts */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 1.5, mb: 2 }}>
        {best && best.day1d > 0 && (
          <Box sx={{ bgcolor: '#e8f5e9', borderRadius: 1.5, p: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            <MdTrendingUp color="#2e7d32" size={22} />
            <Box>
              <Box sx={{ fontSize: 11, color: '#666' }}>Best Today</Box>
              <Box sx={{ fontWeight: 700, fontSize: 14 }}>{best.symbol} <span style={{ color: '#2e7d32' }}>{fmtPct(best.day1d)}</span></Box>
            </Box>
          </Box>
        )}
        {worst && worst.day1d < 0 && (
          <Box sx={{ bgcolor: '#ffebee', borderRadius: 1.5, p: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            <MdTrendingDown color="#c62828" size={22} />
            <Box>
              <Box sx={{ fontSize: 11, color: '#666' }}>Worst Today</Box>
              <Box sx={{ fontWeight: 700, fontSize: 14 }}>{worst.symbol} <span style={{ color: '#c62828' }}>{fmtPct(worst.day1d)}</span></Box>
            </Box>
          </Box>
        )}
        {nearTarget.length > 0 && (
          <Box sx={{ bgcolor: '#fff3e0', borderRadius: 1.5, p: 1.5 }}>
            <Box sx={{ fontSize: 11, color: '#e65100', fontWeight: 600 }}>Near Target ({nearTarget.length})</Box>
            <Box sx={{ fontSize: 12, mt: 0.3 }}>{nearTarget.map(n => n.symbol).join(', ')}</Box>
          </Box>
        )}
        {nearSL.length > 0 && (
          <Box sx={{ bgcolor: '#fce4ec', borderRadius: 1.5, p: 1.5 }}>
            <Box sx={{ fontSize: 11, color: '#c62828', fontWeight: 600 }}>Near Stop Loss ({nearSL.length})</Box>
            <Box sx={{ fontSize: 12, mt: 0.3 }}>{nearSL.map(n => n.symbol).join(', ')}</Box>
          </Box>
        )}
        {overbought > 0 && (
          <Box sx={{ bgcolor: '#fff8e1', borderRadius: 1.5, p: 1.5 }}>
            <Box sx={{ fontSize: 11, color: '#f57f17', fontWeight: 600 }}>RSI &gt; 70 ({overbought})</Box>
            <Box sx={{ fontSize: 12, mt: 0.3 }}>{sigArr.filter(s => s.rsi > 70).map(s => s.symbol).join(', ')}</Box>
          </Box>
        )}
        {oversold > 0 && (
          <Box sx={{ bgcolor: '#e0f7fa', borderRadius: 1.5, p: 1.5 }}>
            <Box sx={{ fontSize: 11, color: '#00838f', fontWeight: 600 }}>RSI &lt; 30 ({oversold})</Box>
            <Box sx={{ fontSize: 12, mt: 0.3 }}>{sigArr.filter(s => s.rsi < 30).map(s => s.symbol).join(', ')}</Box>
          </Box>
        )}
        {inEntryZone.length > 0 && (
          <Box sx={{ bgcolor: '#e8eaf6', borderRadius: 1.5, p: 1.5 }}>
            <Box sx={{ fontSize: 11, color: '#283593', fontWeight: 600 }}>In Entry Zone ≤5% ({inEntryZone.length})</Box>
            <Box sx={{ fontSize: 12, mt: 0.3 }}>{inEntryZone.map(w => w.symbol).join(', ')}</Box>
          </Box>
        )}
        {nearEntry.length > inEntryZone.length && (
          <Box sx={{ bgcolor: '#e3f2fd', borderRadius: 1.5, p: 1.5 }}>
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
            {topMovers.map(w => {
              let status = '—';
              if (w.price && w.target_short_term && Math.abs(w.price - w.target_short_term) / w.target_short_term < 0.05) status = 'Near Target';
              else if (w.price && w.stop_loss && Math.abs(w.price - w.stop_loss) / w.stop_loss < 0.05) status = 'Near SL';
              return (
                <tr key={w.symbol} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '6px 8px', fontWeight: 600 }}>{w.symbol}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmtCur(w.price)}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: pctColor(w.day1d), fontWeight: 600 }}>{fmtPct(w.day1d)}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                    {w.recommendation ? <Chip label={w.recommendation.toUpperCase()} size="small" sx={{ fontSize: 10, fontWeight: 700, height: 20, bgcolor: recoColors[w.recommendation.toUpperCase()] || '#888', color: '#fff' }} /> : '—'}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>{w.composite_score ? fmt(w.composite_score, 0) : '—'}</td>
                  <td style={{ padding: '6px 8px', fontSize: 11, color: status === 'Near SL' ? '#c62828' : status === 'Near Target' ? '#e65100' : '#888' }}>{status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Box>
    </Card>
  );
}

// ─── Weekly Entries (MyIndicator: PSAR + SuperTrend + Fibonacci) ────────────
function WeeklyEntries({ weeklyData }) {
  if (!weeklyData || !weeklyData.length) return null;
  const nearEntries = weeklyData.filter(w => (w.weekly_entry_gap_pct || 100) <= 10);
  if (!nearEntries.length) return null;

  const dirColor = (d) => d === 'up' ? '#2e7d32' : d === 'down' ? '#c62828' : '#888';
  const dirLabel = (d) => d === 'up' ? 'BULLISH' : d === 'down' ? 'BEARISH' : 'NEUTRAL';

  return (
    <Card>
      <SectionTitle>Weekly Entries — MyIndicator (PSAR + SuperTrend + Fib)</SectionTitle>
      <Box sx={{ fontSize: 11, color: '#888', mb: 1 }}>
        Stocks within 5-10% of weekly PSAR/SuperTrend entry zone. Targets via Fibonacci extension.
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
            {nearEntries.map(w => {
              const gap = w.weekly_entry_gap_pct || 0;
              const gapColor = gap <= 5 ? '#283593' : '#1565c0';
              return (
                <tr key={w.symbol} style={{ borderBottom: '1px solid #f0f0f0', backgroundColor: gap <= 5 ? '#e8eaf6' : 'transparent' }}>
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
        <span><b style={{ color: '#283593' }}>Dark Blue</b> = ≤5% from entry</span>
        <span><b style={{ color: '#1565c0' }}>Blue</b> = 5-10% from entry</span>
        <span>Entry = max(W.PSAR, W.SuperTrend) for bullish / min for bearish</span>
        <span>Targets = Fibonacci extension (1.272x, 1.618x)</span>
      </Box>
    </Card>
  );
}

// ─── Order Block Zones (Multi-Timeframe) ────────────────────────────────────
function OrderBlockZones({ obData }) {
  if (!obData || !obData.length) return null;

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
  if (!sectors || !sectors.length) return null;
  const data = sectors.filter(s => s.sector && s.avg_day_change != null).sort((a, b) => Math.abs(b.avg_day_change) - Math.abs(a.avg_day_change));
  if (!data.length) return null;
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
              <Box sx={{ fontSize: 10, opacity: 0.8 }}>{s.stock_count || ''} stocks</Box>
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
  if (!alerts || !alerts.length) return null;
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

// ─── AI Ratings Summary ─────────────────────────────────────────────────────
function LatestRatings({ ratings }) {
  const navigate = useNavigate();
  if (!ratings || !ratings.length) return null;
  const recoColors = { 'STRONG BUY': '#1b5e20', 'BUY': '#43a047', 'HOLD': '#f57f17', 'SELL': '#c62828', 'STRONG SELL': '#b71c1c' };
  return (
    <Card>
      <SectionTitle action={<Chip label="View All" size="small" sx={{ fontSize: 10, cursor: 'pointer' }} onClick={() => navigate('/advisor')} />}>
        Latest AI Ratings
      </SectionTitle>
      {ratings.slice(0, 5).map((r, i) => (
        <Box key={r.symbol || i} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.7, borderBottom: '1px solid #f5f5f5', fontSize: 12 }}>
          <Box sx={{ fontWeight: 700, width: 90 }}>{r.symbol}</Box>
          <Chip label={r.recommendation} size="small" sx={{ fontSize: 9, height: 18, fontWeight: 700, bgcolor: recoColors[r.recommendation] || '#888', color: '#fff', minWidth: 60 }} />
          <Box sx={{ flex: 1, color: '#555' }}>Score: <b>{fmt(r.composite_score, 0)}</b></Box>
          {r.entry_price && <Box sx={{ color: '#555' }}>Entry: {fmtCur(r.entry_price)}</Box>}
          {r.target_short_term && <Box sx={{ color: '#2e7d32' }}>T: {fmtCur(r.target_short_term)}</Box>}
        </Box>
      ))}
    </Card>
  );
}

// ─── Main Dashboard ─────────────────────────────────────────────────────────
function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [indices, setIndices] = useState(null);
  const [watchlist, setWatchlist] = useState([]);
  const [signals, setSignals] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [gainers, setGainers] = useState([]);
  const [losers, setLosers] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [weeklyData, setWeeklyData] = useState([]);
  const [obData, setObData] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadAll = useCallback(async () => {
    try {
      const [idx, wl, sigs, sec, g, l, al, rat, wk, ob] = await Promise.allSettled([
        fetchMarketIndices(),
        fetchWatchlist(),
        fetchWatchlistSignals(),
        fetchSectorOutlook(),
        fetchPriceShockers('gainers', 8, 'day'),
        fetchPriceShockers('losers', 8, 'day'),
        fetchAlerts({ limit: 10 }),
        fetchRatings({ limit: 8 }),
        fetchWeeklyIndicators(),
        fetchOrderBlocks(),
      ]);
      if (idx.status === 'fulfilled') setIndices(idx.value);
      if (wl.status === 'fulfilled') setWatchlist(wl.value);
      if (sigs.status === 'fulfilled') setSignals(sigs.value);
      if (sec.status === 'fulfilled') setSectors(sec.value);
      if (g.status === 'fulfilled') setGainers(g.value);
      if (l.status === 'fulfilled') setLosers(l.value);
      if (al.status === 'fulfilled') setAlerts(al.value);
      if (rat.status === 'fulfilled') setRatings(rat.value);
      if (wk.status === 'fulfilled') setWeeklyData(wk.value);
      if (ob.status === 'fulfilled') setObData(ob.value);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
    const timer = setInterval(loadAll, 60000);
    return () => clearInterval(timer);
  }, [loadAll]);

  return (
    <Box sx={{ width: '100%', px: { xs: 1, sm: 2, md: 3 }, py: { xs: 1, md: 2 }, boxSizing: 'border-box' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ fontWeight: 700, fontSize: 22, color: '#1a3c5e' }}>Dashboard</Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {lastUpdated && <Box sx={{ fontSize: 11, color: '#999' }}>Updated {lastUpdated.toLocaleTimeString()}</Box>}
          <IconButton size="small" onClick={() => { setLoading(true); loadAll(); }} disabled={loading}>
            <MdRefresh size={18} />
          </IconButton>
        </Box>
      </Box>

      {loading && !lastUpdated ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : (
        <>
          {/* Market Pulse Banner */}
          <Box sx={{ mb: 2 }}>
            <MarketPulse indices={indices} />
          </Box>

          {/* Portfolio Snapshot (full width) */}
          <Box sx={{ mb: 2 }}>
            <PortfolioSnapshot watchlist={watchlist} signals={signals} weeklyData={weeklyData} />
          </Box>

          {/* Weekly Entries – MyIndicator (PSAR + ST + Fib) + Order Blocks */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2, '@media (max-width: 1000px)': { gridTemplateColumns: '1fr' } }}>
            <WeeklyEntries weeklyData={weeklyData} />
            <OrderBlockZones obData={obData} />
          </Box>

          {/* Sector Heatmap (full width) */}
          <Box sx={{ mb: 2 }}>
            <SectorHeatmap sectors={sectors} />
          </Box>

          {/* Bottom row: Market Movers + Ratings + Alerts */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, '@media (max-width: 800px)': { gridTemplateColumns: '1fr' } }}>
            <MarketMovers gainers={gainers} losers={losers} />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <LatestRatings ratings={ratings} />
              <RecentAlerts alerts={alerts} />
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
}

export default DashboardPage;
