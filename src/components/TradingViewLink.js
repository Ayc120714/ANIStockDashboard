import React from 'react';

/**
 * Opens a symbol on TradingView.
 * - Default: equity `symbol` → `NSE:{symbol}` (LongTerm / ShortTerm / Advisor tables).
 * - Optional `chartSymbol`: full TV id e.g. `NSE:CNX500`, `BSE:SENSEX` (market / sector outlook indices).
 */
export default function TradingViewLink({ symbol, chartSymbol }) {
  const full = String(chartSymbol || '').trim() || (String(symbol || '').trim() ? `NSE:${String(symbol).trim()}` : '');
  if (!full) return null;
  return (
    <a
      href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(full)}`}
      target="_blank"
      rel="noopener noreferrer"
      title={`View ${full} on TradingView`}
      onClick={(e) => e.stopPropagation()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 18,
        height: 18,
        borderRadius: '50%',
        background: '#131722',
        textDecoration: 'none',
        flexShrink: 0,
      }}
    >
      <svg width="10" height="10" viewBox="0 0 36 28" fill="none" aria-hidden>
        <path d="M14 22H7V11h7v11zm11 0h-7V6h7v16zm11 0h-7V0h7v22z" fill="#2962FF" />
        <rect y="25" width="36" height="3" rx="1.5" fill="#2962FF" />
      </svg>
    </a>
  );
}
