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

/** Chartink weekly cash-segment confirm labels (legacy weekly keys). */
export const WEEKLY_CONFIRM_LABELS = {
  weekly_psar_cross_1w_ago: '1w ago Close × above PSAR(0.02)',
  weekly_close_up: 'Weekly Close > 1w ago Close',
  weekly_prior_dip: '2w ago Close < 3w ago Close',
  weekly_rvol_rising: 'Weekly Vol/EMA20 rising',
};

export const CONFIRM_TF_LABELS = {
  '1d': 'Daily',
  '1w': 'Weekly',
  '1m': 'Monthly',
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

/** True when Chartink weekly PSAR/momentum/rvol block all pass. */
export function isWeeklyConfirmPass(row) {
  if (!row || typeof row !== 'object') return false;
  if (row.weekly_confirm_pass === true) return true;
  const flags = row.weekly_confirm || row.checklist || {};
  return (
    Boolean(flags.weekly_psar_cross_1w_ago)
    && Boolean(flags.weekly_close_up)
    && Boolean(flags.weekly_prior_dip)
    && Boolean(flags.weekly_rvol_rising)
  );
}

/** True when Daily OR Weekly OR Monthly Chartink confirm passes (unified list). */
export function isMtfConfirmPass(row) {
  if (!row || typeof row !== 'object') return false;
  if (row.mtf_confirm_pass === true) return true;
  const tfs = Array.isArray(row.confirm_timeframes) ? row.confirm_timeframes : [];
  if (tfs.length > 0) return true;
  return isWeeklyConfirmPass(row);
}

export function formatConfirmTimeframes(row) {
  const tfs = Array.isArray(row?.confirm_timeframes) ? row.confirm_timeframes : [];
  if (!tfs.length) return '—';
  return tfs.map((tf) => CONFIRM_TF_LABELS[tf] || tf).join('+');
}

export function weeklyConfirmPassedCount(row) {
  const flags = row?.weekly_confirm || {};
  return Object.keys(WEEKLY_CONFIRM_LABELS).filter((k) => Boolean(flags[k])).length;
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
