/** Comma-separated TradingView watchlist paste format: `NSE:SYM,NSE:SYM,...` */
export function buildTradingViewSymbolsCsv(symbols) {
  const seen = new Set();
  const parts = [];
  for (const sym of symbols || []) {
    const s = String(sym || '')
      .trim()
      .toUpperCase();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    parts.push(`NSE:${s}`);
  }
  return parts.join(',');
}
