/**
 * Which live DB alerts may fire Android system push + vibration.
 * Only ML Setups with score >= 0.70. Table-change scanners never push.
 */
import {isDemoAlert, isMlHighConvictionAlert, isVwapCrossAlert} from '@core/utils/alertInboxUtils';

/** Renko Smart / fib-zone alert types persisted by the Renko agent. */
export function isRenkoPushAlert(alert) {
  const t = String(alert?.alert_type || '').toUpperCase();
  return t.startsWith('RENKO_SMART_') || t.startsWith('RENKO_FIB_');
}

/**
 * True when a live advisor DB row may trigger a system push + vibration.
 * Only ML Setups with score >= 0.70. VWAP / demo / other scanners never fire.
 */
export function isPushEligibleLiveAlert(alert) {
  if (!alert || isDemoAlert(alert) || isVwapCrossAlert(alert)) return false;
  return isMlHighConvictionAlert(alert);
}

/** Explicitly excluded from table-change push (not yet submitted for push). */
export const PUSH_EXCLUDED_TABLE_KEYS = Object.freeze(['hot_subsectors']);

export function isPushExcludedTableKey(tableKey) {
  return PUSH_EXCLUDED_TABLE_KEYS.includes(String(tableKey || ''));
}

/**
 * Table-change push: any key registered in ADVISOR_TABLE_META
 * (existing submitted tables + Renko Smart). Excluded keys never push.
 */
export function isPushEligibleTableKey(tableKey, tableMeta = null) {
  void tableKey;
  void tableMeta;
  return false;
}
