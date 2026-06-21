import {alertsService} from '@core/api/services/alertsService';
import {API_TIMEOUT_MS} from '@core/config/apiTimeouts';
import {extractApiRows} from '@core/utils/apiPayload';
import {isDemoAlert, isTodayInIST, parseAdvisorAlertMs} from '@core/utils/alertInboxUtils';
import {MOBILE_ALERTS_LIMIT} from '@core/utils/advisorWebParity';
import {fetchMobileSignalsTabRows} from '@core/utils/advisorHubCache';

function normalizeSymbol(value) {
  return String(value || '').trim().toUpperCase();
}

export const LIVE_ACTION_STATUSES = new Set(['entry_ready', 'in_trade', 'exit_watch', 'done']);

const STATUS_SORT_RANK = {
  entry_ready: 0,
  in_trade: 1,
  exit_watch: 2,
  done: 3,
};

/** True when a signal row was generated during today's live market session (IST). */
export function isSignalRowFromToday(row) {
  if (!row || typeof row !== 'object') return false;
  if (row._liveAlert) {
    return isTodayInIST(row._alertAt);
  }
  if (isTodayInIST(row.scan_time)) return true;
  if (row.daily_entry_triggered && isTodayInIST(row.daily_entry_day)) return true;
  if (row.entry_triggered && isTodayInIST(row.entry_day)) return true;
  return false;
}

/** Live-market entry/exit lifecycle alert from advisor DB. */
export function isLiveEntryExitAlert(alert) {
  const t = String(alert?.alert_type || '').toUpperCase();
  return (
    t === 'ENTRY_READY'
    || t === 'EXIT_READY'
    || t === 'TARGET_DONE'
    || t.startsWith('EARLY_ENTRY_')
    || t.includes('ENTRY')
    || t.includes('EXIT')
  );
}

/** Map intraday advisor alert type → Signals tab status badge. */
export function mapLiveAlertStatus(alert) {
  const detail = alert?.signal_detail && typeof alert.signal_detail === 'object' ? alert.signal_detail : {};
  if (detail.status) return String(detail.status);
  const t = String(alert?.alert_type || '').toUpperCase();
  if (t === 'EXIT_READY' || t.includes('EXIT')) return 'exit_watch';
  if (t === 'TARGET_DONE') return 'done';
  if (t === 'ENTRY_READY' || t.startsWith('EARLY_ENTRY_') || t.includes('ENTRY')) return 'entry_ready';
  return 'entry_ready';
}

/** Row belongs on Signals tab when today's session has an entry/exit lifecycle event. */
export function isActionableTodaySignalRow(row) {
  if (!isSignalRowFromToday(row)) return false;
  if (row._liveAlert) return true;
  const status = String(row?.status || '');
  if (LIVE_ACTION_STATUSES.has(status)) return true;
  if (row.entry_triggered || row.daily_entry_triggered) return true;
  return false;
}

function compareSignalsTabRows(a, b) {
  const liveA = a?._liveAlert ? 0 : 1;
  const liveB = b?._liveAlert ? 0 : 1;
  if (liveA !== liveB) return liveA - liveB;

  const rankA = STATUS_SORT_RANK[String(a?.status || '')] ?? 9;
  const rankB = STATUS_SORT_RANK[String(b?.status || '')] ?? 9;
  if (rankA !== rankB) return rankA - rankB;

  const scoreA = Number(a?.conviction_score ?? a?.signal_score ?? 0);
  const scoreB = Number(b?.conviction_score ?? b?.signal_score ?? 0);
  if (scoreA !== scoreB) return scoreB - scoreA;

  return (
    parseAdvisorAlertMs(b?._alertAt || b?.scan_time)
    - parseAdvisorAlertMs(a?._alertAt || a?.scan_time)
  );
}

/** Map live advisor DB alert → Signals tab card row. */
export function liveAlertToSignalRow(alert) {
  const symbol = normalizeSymbol(alert?.symbol);
  const detail = alert?.signal_detail && typeof alert.signal_detail === 'object' ? alert.signal_detail : {};
  const entry = alert?.entry_price ?? detail.entry;
  const sl = alert?.stop_loss ?? detail.stop_loss;
  const t1 = alert?.target_1 ?? detail.target_1;
  const t2 = alert?.target_2 ?? detail.target_2;
  const score = alert?.signal_score ?? detail.signal_score;
  const alertType = String(alert?.alert_type || '').toLowerCase();
  const bearish = alertType.includes('sell') || alertType.includes('bear') || alertType.includes('exit');
  const status = mapLiveAlertStatus(alert);
  return {
    id: alert?.id,
    symbol,
    status,
    trend: alert?.trend || (bearish ? 'bearish' : 'bullish'),
    entry_price: entry,
    stop_loss: sl,
    target_1: t1,
    target_2: t2,
    cmp: alert?.cmp ?? entry,
    pct_from_entry: alert?.pct_from_entry,
    conviction_score: score,
    signal_score: score,
    high_conviction: Number(score) > 25,
    _liveAlert: true,
    _alertType: alert?.alert_type,
    _alertMessage: alert?.message,
    _alertAt: alert?.timestamp || alert?.created_at || alert?.alert_time,
  };
}

/** Today's live-market entry/exit rows: triggered alerts first, then actionable scanned signals. */
export function buildSignalsTabRows(signals = [], liveAlerts = []) {
  const todayLive = (Array.isArray(liveAlerts) ? liveAlerts : [])
    .filter(row => isTodayInIST(row?.timestamp || row?.created_at || row?.alert_time))
    .filter(row => !isDemoAlert(row))
    .filter(row => isLiveEntryExitAlert(row))
    .map(liveAlertToSignalRow)
    .filter(row => row.symbol)
    .sort((a, b) => parseAdvisorAlertMs(b._alertAt) - parseAdvisorAlertMs(a._alertAt));

  const liveBySymbol = new Map();
  for (const row of todayLive) {
    if (!liveBySymbol.has(row.symbol)) {
      liveBySymbol.set(row.symbol, row);
    }
  }
  const liveList = [...liveBySymbol.values()];
  const liveSymbols = new Set(liveList.map(row => row.symbol));

  const rest = (Array.isArray(signals) ? signals : [])
    .filter(row => !liveSymbols.has(normalizeSymbol(row?.symbol)))
    .filter(isActionableTodaySignalRow);

  return [...liveList, ...rest].sort(compareSignalsTabRows);
}

/** Scanned advisor signals only — live entry/exit alerts belong on the Alerts screen. */
export async function fetchSignalsTabPayload() {
  const signals = await fetchMobileSignalsTabRows();
  return buildSignalsTabRows(signals, []);
}

/** Today's live entry/exit advisor alerts with Entry / SL / targets. */
export async function fetchAlertsTabPayload() {
  const liveRes = await alertsService
    .fetchLiveAdvisorAlerts({limit: MOBILE_ALERTS_LIMIT, timeoutMs: API_TIMEOUT_MS.advisor})
    .catch(() => []);
  const liveAlerts = Array.isArray(liveRes) ? liveRes : extractApiRows(liveRes);
  return buildSignalsTabRows([], liveAlerts);
}
