export function formatINR(n) {
  if (n == null || n === '' || Number.isNaN(Number(n))) return '—';
  const v = Number(n);
  try {
    return `₹${v.toLocaleString('en-IN', {maximumFractionDigits: 2})}`;
  } catch {
    return `₹${v.toFixed(2)}`;
  }
}

/** Format market cap string like "42255Cr" for display */
export function formatMarketCap(raw) {
  if (raw == null || raw === '') return '—';
  const s = String(raw).trim();
  if (/cr|Cr|L|lacs/i.test(s)) return s;
  const n = Number(s.replace(/,/g, ''));
  if (!Number.isFinite(n)) return s;
  if (n >= 1e7) return `${(n / 1e7).toFixed(2)}Cr`;
  if (n >= 1e5) return `${(n / 1e5).toFixed(2)}L`;
  return n.toLocaleString('en-IN');
}

export function heatColorFromPct(p) {
  if (p == null || Number.isNaN(Number(p))) return '#f1f5f9';
  const n = Number(p);
  if (n >= 2) return '#dcfce7';
  if (n <= -2) return '#fee2e2';
  return '#fef9c3';
}
