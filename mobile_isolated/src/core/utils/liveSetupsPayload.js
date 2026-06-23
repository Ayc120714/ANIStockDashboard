import {alertsService} from '@core/api/services/alertsService';
import {signalsService} from '@core/api/services/signalsService';
import {API_TIMEOUT_MS} from '@core/config/apiTimeouts';
import {extractApiRows} from '@core/utils/apiPayload';
import {isDemoAlert, isTodayInIST, parseAdvisorAlertMs} from '@core/utils/alertInboxUtils';
import {ADVISOR_WEB_LIMITS} from '@core/utils/advisorWebParity';
import {shouldRemoveSetupRow} from '@core/utils/setupLifecycle';

function normalizeSymbol(value) {
  return String(value || '').trim().toUpperCase();
}

export const LIVE_ACTION_STATUSES = new Set(['entry_ready', 'in_trade', 'exit_watch']);

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

export function mapLiveAlertStatus(alert) {
  const detail = alert?.signal_detail && typeof alert.signal_detail === 'object' ? alert.signal_detail : {};
  if (detail.status) return String(detail.status);
  const t = String(alert?.alert_type || '').toUpperCase();
  if (t === 'EXIT_READY' || t.includes('EXIT')) return 'exit_watch';
  if (t === 'TARGET_DONE' || t === 'STOP_LOSS_HIT') return 'done';
  if (t === 'ENTRY_READY' || t.startsWith('EARLY_ENTRY_') || t.includes('ENTRY')) return 'entry_ready';
  return 'entry_ready';
}

export function liveAlertToSetupRow(alert) {
  const symbol = normalizeSymbol(alert?.symbol);
  const detail = alert?.signal_detail && typeof alert.signal_detail === 'object' ? alert.signal_detail : {};
  const alertType = String(alert?.alert_type || '').toLowerCase();
  const bearish = alertType.includes('sell') || alertType.includes('bear') || alertType.includes('exit');
  const ts = alert?.timestamp || alert?.created_at || alert?.alert_time;
  return {
    id: alert?.id,
    symbol,
    status: mapLiveAlertStatus(alert),
    trend: alert?.trend || (bearish ? 'bearish' : 'bullish'),
    entry_price: alert?.entry_price ?? detail.entry,
    stop_loss: alert?.stop_loss ?? detail.stop_loss,
    target_1: alert?.target_1 ?? detail.target_1,
    target_2: alert?.target_2 ?? detail.target_2,
    cmp: alert?.cmp ?? alert?.entry_price ?? detail.entry,
    conviction_score: alert?.signal_score ?? detail.signal_score,
    signal_score: alert?.signal_score ?? detail.signal_score,
    _liveAlert: true,
    _alertType: alert?.alert_type,
    _alertMessage: alert?.message,
    _alertAt: ts,
    setup_at: ts,
  };
}

export function isActionableSetupSignalRow(row) {
  const status = String(row?.status || '');
  if (LIVE_ACTION_STATUSES.has(status)) return true;
  if (row?.entry_triggered || row?.daily_entry_triggered) return true;
  if (row?.high_conviction && row?.entry_price && row?.stop_loss) return true;
  return false;
}

export function getSetupTimestamp(row) {
  return row?._alertAt || row?.setup_at || row?.scan_time || row?.entry_day || row?.timestamp;
}

export function isTodaySetupRow(row) {
  return isTodayInIST(getSetupTimestamp(row));
}

export function isThisWeekSetupRow(row) {
  const ms = parseAdvisorAlertMs(getSetupTimestamp(row));
  if (!ms) return false;
  const weekAgo = Date.now() - 7 * 86400000;
  return ms >= weekAgo;
}

export function buildLiveSetupRows(signals = [], liveAlerts = []) {
  const todayLive = (Array.isArray(liveAlerts) ? liveAlerts : [])
    .filter(row => isThisWeekSetupRow({setup_at: row?.timestamp || row?.created_at || row?.alert_time}))
    .filter(row => !isDemoAlert(row))
    .filter(row => isLiveEntryExitAlert(row))
    .map(liveAlertToSetupRow)
    .filter(row => row.symbol);

  const liveBySymbol = new Map();
  for (const row of todayLive.sort((a, b) => parseAdvisorAlertMs(b._alertAt) - parseAdvisorAlertMs(a._alertAt))) {
    if (!liveBySymbol.has(row.symbol)) liveBySymbol.set(row.symbol, row);
  }
  const liveList = [...liveBySymbol.values()];
  const liveSymbols = new Set(liveList.map(row => row.symbol));

  const rest = (Array.isArray(signals) ? signals : [])
    .filter(row => row?.cmp && row?.entry_price)
    .filter(row => !liveSymbols.has(normalizeSymbol(row?.symbol)))
    .filter(isActionableSetupSignalRow)
    .filter(isThisWeekSetupRow)
    .map(row => ({
      ...row,
      setup_at: getSetupTimestamp(row),
    }));

  const merged = [...liveList, ...rest];
  const bySymbol = new Map();
  for (const row of merged.sort((a, b) => parseAdvisorAlertMs(getSetupTimestamp(b)) - parseAdvisorAlertMs(getSetupTimestamp(a)))) {
    const sym = normalizeSymbol(row.symbol);
    if (!sym || bySymbol.has(sym)) continue;
    bySymbol.set(sym, {...row, symbol: sym});
  }

  return [...bySymbol.values()].filter(row => !shouldRemoveSetupRow(row));
}

/** Same payload contract as web LiveSetupsPage (`/alerts`). */
export async function fetchLiveSetupsPayload() {
  const timeoutMs = API_TIMEOUT_MS.advisor;
  const [signalsRes, alertsRes] = await Promise.allSettled([
    signalsService.fetchLatestSignals({
      limit: ADVISOR_WEB_LIMITS.latestSignals,
      timeoutMs,
    }),
    alertsService.fetchLiveAdvisorAlerts({
      limit: ADVISOR_WEB_LIMITS.latestSignals,
      timeoutMs,
    }),
  ]);
  const signals = signalsRes.status === 'fulfilled'
    ? (Array.isArray(signalsRes.value) ? signalsRes.value : extractApiRows(signalsRes.value))
    : [];
  const alerts = alertsRes.status === 'fulfilled'
    ? (Array.isArray(alertsRes.value) ? alertsRes.value : extractApiRows(alertsRes.value))
    : [];
  return buildLiveSetupRows(signals, alerts);
}

export function partitionLiveSetups(rows = []) {
  const active = (Array.isArray(rows) ? rows : []).filter(row => !shouldRemoveSetupRow(row));
  const today = active.filter(isTodaySetupRow);
  const week = active.filter(isThisWeekSetupRow);
  return {today, week, active};
}
