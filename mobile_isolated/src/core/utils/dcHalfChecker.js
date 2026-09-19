/** Shared DC_HALF phase / TF helpers for mobile Screens hub (web parity). */

export const DC_HALF_TF_TABS = [
  {id: '5m', label: '5M'},
  {id: '30m', label: '30M'},
  {id: '1h', label: '1H'},
  {id: '1d', label: '1D'},
  {id: '1w', label: '1W'},
];

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
