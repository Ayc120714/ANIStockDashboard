/**
 * Dashboard Sector Performance cards — same 1D source as Sector Insights
 * (`fetchSectorOutlook` / normalizeRow day1d → day1dNum / avg_day_change).
 */

export function parseSectorPercentLike(value) {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = String(value);
  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

/** Prefer numeric fields written by sectorOutlook.normalizeRow; fall back to day1d string. */
export function sectorDayChangePct(row) {
  if (!row || typeof row !== 'object') return null;
  if (row.day1dNum != null && Number.isFinite(Number(row.day1dNum))) {
    return Number(row.day1dNum);
  }
  if (row.avg_day_change != null && Number.isFinite(Number(row.avg_day_change))) {
    return Number(row.avg_day_change);
  }
  return parseSectorPercentLike(row.day1d ?? row.day_change ?? row.perf_1d);
}

/**
 * Build heatmap cards from Sector Insights rows (top movers by |1D|).
 * Subtitle uses CMP (`value`) — same field as Sector Insights — not stock_count
 * (sector-outlook API does not return constituent counts; Number(null) was showing "0 stocks").
 */
export function buildSectorPerformanceCards(sectors, { limit = 12 } = {}) {
  const rows = (Array.isArray(sectors) ? sectors : [])
    .map((s) => {
      const name = String(s?.sector || s?.name || '').trim();
      if (!name) return null;
      const day = sectorDayChangePct(s);
      if (day == null || !Number.isFinite(day)) return null;
      const rawCount = s?.stock_count;
      const stock_count =
        rawCount != null && rawCount !== '' && Number.isFinite(Number(rawCount))
          ? Number(rawCount)
          : null;
      return {
        sector: name,
        name,
        avg_day_change: day,
        day1d: s.day1d,
        day1dNum: day,
        value: s.value ?? s.cmp ?? '—',
        trend: s.trend || '—',
        stock_count,
      };
    })
    .filter(Boolean)
    .sort((a, b) => Math.abs(b.avg_day_change) - Math.abs(a.avg_day_change));

  return rows.slice(0, Math.max(0, limit));
}

export function formatSectorCardSubtitle(card) {
  if (!card || typeof card !== 'object') return '—';
  if (card.stock_count != null && Number.isFinite(Number(card.stock_count))) {
    return `${Number(card.stock_count)} stocks`;
  }
  const cmp = card.value;
  if (cmp != null && String(cmp).trim() && String(cmp).trim() !== '—') {
    return String(cmp).trim();
  }
  return '—';
}
