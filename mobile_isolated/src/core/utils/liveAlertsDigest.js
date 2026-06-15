import {parseAdvisorAlertMs} from '@core/utils/alertInboxUtils';

/** Stable key for live advisor DB alert rows. */
export function liveAlertDigestKey(row) {
  const id = String(row?.id ?? row?.alert_id ?? '').trim();
  const sym = String(row?.symbol || '').trim().toUpperCase();
  const ts = parseAdvisorAlertMs(row?.created_at || row?.alert_time || row?.updated_at);
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
