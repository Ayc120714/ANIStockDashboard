import {isTodayInIST, parseAdvisorAlertMs} from '@core/utils/alertInboxUtils';
import {isPushEligibleLiveAlert} from '@core/utils/pushNotificationEligibility';

/** API live-alert rows use `timestamp`; older payloads used created_at / alert_time. */
export function liveAlertTimestamp(row) {
  return row?.created_at || row?.alert_time || row?.updated_at || row?.timestamp;
}

/** Stable key for live advisor DB alert rows. */
export function liveAlertDigestKey(row) {
  const id = String(row?.id ?? row?.alert_id ?? '').trim();
  const sym = String(row?.symbol || '').trim().toUpperCase();
  const ts = parseAdvisorAlertMs(liveAlertTimestamp(row));
  const type = String(row?.alert_type || row?.source || '').trim();
  if (id) return `${id}:${sym}:${type}`;
  return `${sym}:${type}:${ts}`;
}

export function liveAlertsDigest(rows) {
  return (rows || [])
    .map(liveAlertDigestKey)
    .filter(Boolean)
    .sort()
    .join('|');
}

export function diffNewLiveAlerts(prevDigest, rows) {
  const prev = new Set(String(prevDigest || '').split('|').filter(Boolean));
  return (rows || []).filter(row => {
    const key = liveAlertDigestKey(row);
    return key && !prev.has(key);
  });
}

/**
 * System push + vibration candidates.
 * Empty stored digest = cold start: seed only, do not notify.
 * If a digest already exists (app was used before), notify on the first poll too —
 * otherwise new rows are saved as "seen" and never vibrate.
 */
export function freshLiveAlertsToNotify(prevDigest, rows) {
  if (!String(prevDigest || '').trim()) return [];
  return diffNewLiveAlerts(prevDigest, rows).filter(row => {
    if (row?.is_read) return false;
    if (!isPushEligibleLiveAlert(row)) return false;
    return isTodayInIST(liveAlertTimestamp(row));
  });
}
