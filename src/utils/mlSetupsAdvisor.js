/**
 * Pure helpers for Advisor ML Setups tab (web + shared tests).
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

/**
 * pageDataCache wraps values as `{ data, updatedAt }`. ML Setups stores
 * `{ data: rows, meta }` inside that, so rows live at `cached.data.data`.
 * Never treat a non-array cache object as the row list (spreading it crashes React).
 */
export function mlSetupsRowsAndMetaFromCache(cached) {
  const wrap = cached && typeof cached === 'object' ? cached : {};
  const inner = wrap.data;
  if (Array.isArray(inner)) {
    return { rows: inner.filter((row) => row && String(row.symbol || '').trim()), meta: {} };
  }
  if (inner && typeof inner === 'object') {
    const rows = Array.isArray(inner.data) ? inner.data : [];
    const meta = inner.meta && typeof inner.meta === 'object' ? inner.meta : {};
    return {
      rows: rows.filter((row) => row && String(row.symbol || '').trim()),
      meta,
    };
  }
  return { rows: [], meta: {} };
}

export function ensureMlSetupRows(rows) {
  return Array.isArray(rows) ? rows : [];
}
