/**
 * Compression → Breakout → Retest → Renewed Participation helpers.
 * Keep labels in sync with backend PHASE_LABELS / checklist keys.
 */

export const COMPRESSION_BREAKOUT_PHASES = [
  { id: '', label: 'Actionable (all)' },
  { id: 'breakout', label: 'Breakout / expansion' },
  { id: 'retest_hold', label: 'Retest held' },
  { id: 'renewed', label: 'Renewed participation' },
  { id: 'compression', label: 'Compression watch' },
  { id: 'cup60', label: '60% cup (early)' },
];

export const COMPRESSION_BREAKOUT_TIMEFRAMES = [
  { id: 'all', label: 'All (D+W)' },
  { id: '1d', label: 'Daily' },
  { id: '1w', label: 'Weekly' },
];

export const CHECKLIST_LABELS = {
  compression_first: 'Compression first?',
  volume_expanded: 'Volume expanded?',
  strong_close: 'Strong close?',
  level_held: 'Level held?',
  retest_volume_lighter: 'Retest volume lighter?',
  renewed_participation: 'Renewed participation?',
};

export function formatPhaseLabel(phase) {
  const key = String(phase || '').trim().toLowerCase();
  if (key === 'breakout') return 'Breakout';
  if (key === 'retest_hold') return 'Retest held';
  if (key === 'renewed') return 'Renewed';
  if (key === 'compression') return 'Compression';
  if (key === 'cup60') return '60% cup';
  return key || '—';
}

export function phaseChipColor(phase) {
  const key = String(phase || '').trim().toLowerCase();
  if (key === 'renewed') return 'success';
  if (key === 'retest_hold') return 'info';
  if (key === 'breakout') return 'warning';
  if (key === 'compression') return 'default';
  if (key === 'cup60') return 'success';
  return 'default';
}

export function checklistPassedCount(checklist) {
  if (!checklist || typeof checklist !== 'object') return 0;
  return Object.values(checklist).filter(Boolean).length;
}

export function formatEvidenceScore(score, max = 6) {
  if (score == null || Number.isNaN(Number(score))) return '—';
  return `${Number(score)}/${max}`;
}
