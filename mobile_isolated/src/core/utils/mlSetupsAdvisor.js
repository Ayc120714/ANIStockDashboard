/**
 * Pure helpers for Advisor ML Setups tab (mobile, keep in sync with web).
 */

export const ML_SETUPS_DEFAULT_MIN_SCORE = 0.55;

export function normalizeMlSetupsPayload(payload) {
  const data = payload && typeof payload === 'object' ? payload : {};
  const rows = Array.isArray(data.data)
    ? data.data
    : Array.isArray(data.setups)
      ? data.setups
      : [];
  const minScore = Number(data.min_score);
  return {
    session_date: String(data.session_date || ''),
    checkpoint: String(data.checkpoint || ''),
    ready_for_open: Boolean(data.ready_for_open),
    live_enabled: Boolean(data.live_enabled),
    min_score: Number.isFinite(minScore) ? minScore : ML_SETUPS_DEFAULT_MIN_SCORE,
    feature_symbols: Number(data.feature_symbols) || 0,
    total_scored: Number(data.total_scored) || rows.length,
    high_conviction: Number(data.high_conviction) || 0,
    setup_counts: data.setup_counts && typeof data.setup_counts === 'object' ? data.setup_counts : {},
    metrics: data.metrics && typeof data.metrics === 'object' ? data.metrics : {},
    data: rows.filter((row) => row && String(row.symbol || '').trim()),
  };
}

export function formatMlSetupType(alertType) {
  return String(alertType || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function mlSetupDirectionLabel(row) {
  const side = Number(row?.side);
  if (side === 1 || String(row?.direction || '').toUpperCase() === 'LONG') return 'Long';
  if (side === -1 || String(row?.direction || '').toUpperCase() === 'SHORT') return 'Short';
  return '—';
}

export function ensureMlSetupRows(rows) {
  return Array.isArray(rows) ? rows : [];
}

/** Unique symbols in display order for TradingView Copy CSV. */
export function symbolsFromMlSetupRows(rows) {
  const seen = new Set();
  const out = [];
  for (const row of ensureMlSetupRows(rows)) {
    const symbol = String(row?.symbol || '').trim().toUpperCase();
    if (!symbol || seen.has(symbol)) continue;
    seen.add(symbol);
    out.push(symbol);
  }
  return out;
}
