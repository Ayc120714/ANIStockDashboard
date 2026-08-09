/**
 * Which live DB alerts may fire Android system push notifications.
 *
 * Scope: Renko Smart (this release) + already-submitted entry/exit lifecycle
 * alerts. New advisor tabs (e.g. Hot Subsectors) must not be added here until
 * explicitly released for push.
 */
import {isDemoAlert} from '@core/utils/alertInboxUtils';
import {isLiveEntryExitAlert} from '@core/utils/signalsTabPayload';

/** Renko Smart / fib-zone alert types persisted by the Renko agent. */
export function isRenkoPushAlert(alert) {
  const t = String(alert?.alert_type || '').toUpperCase();
  return t.startsWith('RENKO_SMART_') || t.startsWith('RENKO_FIB_');
}

/**
 * True when a live advisor DB row may trigger a system push.
 * Demo / test rows are never eligible.
 */
export function isPushEligibleLiveAlert(alert) {
  if (!alert || isDemoAlert(alert)) return false;
  if (isRenkoPushAlert(alert)) return true;
  // Already-submitted live lifecycle alerts (ENTRY_READY, EXIT_READY, …).
  return isLiveEntryExitAlert(alert);
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
  const key = String(tableKey || '');
  if (!key || isPushExcludedTableKey(key)) return false;
  if (tableMeta && typeof tableMeta === 'object') {
    return Boolean(tableMeta[key]);
  }
  // Lazy require avoids circular import at module load.
  // eslint-disable-next-line global-require
  const {ADVISOR_TABLE_META} = require('@core/utils/advisorTableSnapshots');
  return Boolean(ADVISOR_TABLE_META[key]);
}
