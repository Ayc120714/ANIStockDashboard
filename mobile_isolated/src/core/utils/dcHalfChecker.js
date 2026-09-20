/** Shared DC_HALF phase / TF helpers for mobile Screens hub (web parity). */

export const DC_HALF_TF_TABS = [
  {id: '5m', label: '5M'},
  {id: '30m', label: '30M'},
  {id: '1h', label: '1H'},
  {id: '1d', label: '1D'},
  {id: '1w', label: '1W'},
];

/** TFs that fire volume-expand live alerts (excludes weekly). */
export const DC_HALF_ALERT_TIMEFRAMES = ['5m', '30m', '1h', '1d'];

const PHASE_LABELS = {
  cross_up: 'Cross up',
  at_dc_high: 'At DC high',
  retrace_dc_mid: 'Retrace mid',
  retrace_dc_low: 'Retrace low',
  rising_again: 'Rising again',
  above_mid: 'Above mid',
};

export function formatDcHalfPhaseLabel(phase) {
  const key = String(phase || '').trim().toLowerCase();
  return PHASE_LABELS[key] || (key ? key.replace(/_/g, ' ') : '—');
}

/** True when Chartink PSAR confirm block passed on this TF. */
export function isDcHalfPsarConfirm(row) {
  if (!row || typeof row !== 'object') return false;
  if (row.psar_confirm === true) return true;
  const f = row.confirm_flags || {};
  return Boolean(f.psar_cross && f.close_up && f.prior_dip && f.rvol_rising);
}

/** True when relative volume is expanding on this TF (alert trigger). */
export function isDcHalfVolumeExpanding(row) {
  if (!row || typeof row !== 'object') return false;
  if (row.volume_expanding === true) return true;
  return Boolean(row.confirm_flags?.rvol_rising);
}

export function formatDcHalfRvol(row) {
  const a = row?.volume_ratio_prev;
  const b = row?.volume_ratio;
  if (a == null && b == null) return '—';
  if (a == null) return Number(b).toFixed(2);
  if (b == null) return Number(a).toFixed(2);
  return `${Number(a).toFixed(2)}→${Number(b).toFixed(2)}`;
}
