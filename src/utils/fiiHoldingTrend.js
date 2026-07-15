/** Normalize FII holding % (backend may send 0–1 fraction or 0–100 percent). */
export function normalizeFiiPct(value) {
  if (value == null || value === '' || Number.isNaN(Number(value))) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.abs(n) <= 1 ? n * 100 : n;
}

/** Extract up to four FII holding quarters, newest-first. */
export function normalizeFiiHoldingQuarters(row) {
  if (!row || typeof row !== 'object') return [];
  const raw = row.fii_holding_quarters
    ?? row.fii_quarters
    ?? row.fii_holdings
    ?? row.fii_holding?.quarters
    ?? [];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const pct = entry.pct ?? entry.fii_holding_pct ?? entry.holding_pct ?? entry.value;
      const period = entry.period ?? entry.quarter ?? entry.label ?? entry.date ?? '';
      const normalized = normalizeFiiPct(pct);
      if (normalized == null) return null;
      return { period: String(period || ''), pct: normalized };
    })
    .filter(Boolean)
    .slice(0, 4);
}

/** Latest FII holding % for sorting (first quarter or direct field). */
export function getLatestFiiHoldingPct(row) {
  const quarters = normalizeFiiHoldingQuarters(row);
  if (quarters.length) return quarters[0].pct;
  return normalizeFiiPct(row?.fii_holding_pct ?? row?.fii_holding?.pct);
}

/** Compact chain: `14.20 ≥ 13.80 ≥ 13.80 ≥ 12.95` or `—`. */
export function formatFiiHoldingChain(source) {
  const quarters = Array.isArray(source) ? source : normalizeFiiHoldingQuarters(source);
  if (!quarters.length) return '—';
  return quarters.map((q) => q.pct.toFixed(2)).join(' ≥ ');
}

/** Tooltip/title with period labels where available. */
export function buildFiiHoldingTooltip(source) {
  const quarters = Array.isArray(source) ? source : normalizeFiiHoldingQuarters(source);
  if (!quarters.length) return 'FII holding trend unavailable';
  return quarters
    .map((q) => {
      const label = q.period || '—';
      return `${label}: ${q.pct.toFixed(2)}%`;
    })
    .join('\n');
}

/** Map API row to display/sort fields for chart-fundamental tables. */
export function mapFiiHoldingFields(row) {
  const quarters = normalizeFiiHoldingQuarters(row);
  return {
    fii4qLabel: formatFiiHoldingChain(quarters),
    fii4qTooltip: buildFiiHoldingTooltip(quarters),
    fii4qSort: getLatestFiiHoldingPct(row),
    fii_holding_trend_ok: row?.fii_holding_trend_ok,
  };
}
