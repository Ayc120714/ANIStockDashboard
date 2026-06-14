/** Holdings P&L helpers — parity with web DashboardPage HoldingsList. */

export function holdingSymbol(h) {
  return String(h?.symbol || h?.tradingSymbol || h?.symbolName || h?.scripName || '').trim().toUpperCase() || '—';
}

export function holdingQty(h) {
  const n = Number(h?.net_qty ?? h?.netQty ?? h?.totalQty ?? h?.quantity);
  return Number.isFinite(n) ? n : 0;
}

export function holdingAvgPrice(h) {
  const n = Number(h?.avg_price ?? h?.avgPrice ?? h?.buyAvg ?? h?.averagePrice ?? h?.avgCostPrice);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function holdingLtp(h) {
  const n = Number(h?.ltp ?? h?.lastPrice ?? h?.lastTradedPrice ?? h?.price);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function holdingPnlAmount(h) {
  const direct = Number(h?.unrealized_pnl ?? h?.unrealizedPnl ?? h?.pnl);
  if (Number.isFinite(direct) && direct !== 0) return direct;
  const avg = holdingAvgPrice(h);
  const ltp = holdingLtp(h);
  const qty = holdingQty(h);
  if (avg != null && ltp != null && qty !== 0) return (ltp - avg) * qty;
  return Number.isFinite(direct) ? direct : null;
}

export function holdingPnlPctFromAvg(h) {
  const cached = Number(h?.pnl_pct ?? h?.pnlPct);
  if (Number.isFinite(cached)) return cached;
  const avg = holdingAvgPrice(h);
  const ltp = holdingLtp(h);
  if (avg != null && ltp != null) return ((ltp - avg) / avg) * 100;
  const pnl = holdingPnlAmount(h);
  const qty = holdingQty(h);
  if (avg != null && qty !== 0 && pnl != null) return (pnl / (avg * Math.abs(qty))) * 100;
  return null;
}

export function pnlColor(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return '#374151';
  return n > 0 ? '#15803d' : '#b91c1c';
}

export function formatHoldingPct(v) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  const n = Number(v);
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

export function summarizeHoldings(holdings = []) {
  const rows = Array.isArray(holdings) ? holdings : [];
  const totalUnrealized = rows.reduce((sum, h) => sum + Number(h?.unrealized_pnl || 0), 0);
  const totalRealized = rows.reduce((sum, h) => sum + Number(h?.realized_pnl || 0), 0);
  const totalHoldingsPnl = totalUnrealized + totalRealized;
  const dayPnl = rows.reduce(
    (sum, h) => sum + Number(h?.day_pnl ?? h?.dayPnl ?? h?.mtm ?? h?.unrealized_pnl ?? 0),
    0,
  );
  return {totalUnrealized, totalRealized, totalHoldingsPnl, dayPnl, count: rows.length};
}
