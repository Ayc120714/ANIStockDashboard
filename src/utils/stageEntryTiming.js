/** FFIP Stage Analysis & Entry Timing — display helpers. */

export const STAGE_ENTRY_TIMING_OPTIONS = [
  { id: '', label: 'All timings' },
  { id: 'breakout_watch', label: 'Breakout watch' },
  { id: 'constructive_pullback', label: 'Constructive pullback' },
  { id: 'stage2_watch', label: 'Stage 2 watch' },
  { id: 'extended', label: 'Extended' },
  { id: 'deteriorating', label: 'Deteriorating' },
];

export const ENTRY_TIMING_LABELS = {
  breakout_watch: 'Breakout watch',
  constructive_pullback: 'Constructive pullback',
  stage2_watch: 'Stage 2 watch',
  extended: 'Extended',
  deteriorating: 'Deteriorating',
  out_of_stage: 'Out of Stage 2',
};

export function formatEntryTiming(timing) {
  const key = String(timing || '').trim().toLowerCase();
  return ENTRY_TIMING_LABELS[key] || (key ? key.replace(/_/g, ' ') : '—');
}

export function formatStageLabel(stage, fallback) {
  if (fallback) return String(fallback);
  const n = Number(stage);
  if (n === 2) return 'Stage 2 — Advancing';
  if (n === 1) return 'Stage 1 — Basing';
  if (n === 3) return 'Stage 3 — Topping';
  if (n === 4) return 'Stage 4 — Declining';
  return '—';
}

export function formatMinerviniScore(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return '—';
  return `${n}/8`;
}

export function formatRsCross(row) {
  const prev = row?.rs_rating_prev;
  const curr = row?.rs_rating;
  if (curr == null && prev == null) return '—';
  if (prev == null) return String(curr);
  return `${prev}→${curr}`;
}

/** True when RS just crossed ≥70 and Stage 2 + other Minervini criteria pass. */
export function isRsCrossSetupRow(row) {
  if (!row || typeof row !== 'object') return false;
  if (row.rs_just_crossed_70 && row.other_setup_pass) return true;
  const prev = Number(row.rs_rating_prev);
  const curr = Number(row.rs_rating);
  if (!Number.isFinite(prev) || !Number.isFinite(curr)) return false;
  return prev < 70 && curr >= 70 && row.other_setup_pass === true;
}

export function entryTimingChipColor(timing) {
  const key = String(timing || '').trim().toLowerCase();
  if (key === 'breakout_watch') return { bgcolor: '#e8f5e9', color: '#1b5e20' };
  if (key === 'constructive_pullback') return { bgcolor: '#e3f2fd', color: '#0d47a1' };
  if (key === 'stage2_watch') return { bgcolor: '#fff8e1', color: '#f57f17' };
  if (key === 'extended') return { bgcolor: '#fce4ec', color: '#ad1457' };
  if (key === 'deteriorating') return { bgcolor: '#ffebee', color: '#c62828' };
  return { bgcolor: '#f5f5f5', color: '#546e7a' };
}
