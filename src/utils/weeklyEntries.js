export function hasDuplicateWeeklyEntrySymbols(rows = []) {
  const seen = new Set();
  for (const row of rows) {
    const sym = String(row?.symbol || '').trim().toUpperCase();
    if (!sym) continue;
    if (seen.has(sym)) return true;
    seen.add(sym);
  }
  return false;
}

/** One row per symbol for Weekly Entries — smallest gap% wins. */
export function dedupeWeeklyEntriesBySymbol(rows = []) {
  const best = new Map();
  for (const row of rows) {
    const sym = String(row?.symbol || '').trim().toUpperCase();
    if (!sym) continue;
    const gap = Number(row?.weekly_entry_gap_pct);
    const prev = best.get(sym);
    if (!prev) {
      best.set(sym, row);
      continue;
    }
    const prevGap = Number(prev?.weekly_entry_gap_pct);
    if (Number.isFinite(gap) && (!Number.isFinite(prevGap) || gap < prevGap)) {
      best.set(sym, row);
    }
  }
  return [...best.values()].sort(
    (a, b) => (Number(a?.weekly_entry_gap_pct) || 100) - (Number(b?.weekly_entry_gap_pct) || 100),
  );
}
