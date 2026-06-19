import {alertsService} from '@core/api/services/alertsService';
import {API_TIMEOUT_MS} from '@core/config/apiTimeouts';
import {extractApiRows} from '@core/utils/apiPayload';
import {isTodayInIST, parseAdvisorAlertMs} from '@core/utils/alertInboxUtils';
import {MOBILE_ALERTS_LIMIT} from '@core/utils/advisorWebParity';
import {fetchMobileSignalsTabRows} from '@core/utils/advisorHubCache';

function normalizeSymbol(value) {
  return String(value || '').trim().toUpperCase();
}

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
  const bearish = alertType.includes('sell') || alertType.includes('bear');
  return {
    id: alert?.id,
    symbol,
    status: detail.status || alert?.status || 'entry_ready',
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

/** Today's live-market rows only: triggered alerts first, then today's scanned signals (no duplicate symbols). */
export function buildSignalsTabRows(signals = [], liveAlerts = []) {
  const todayLive = (Array.isArray(liveAlerts) ? liveAlerts : [])
    .filter(row => isTodayInIST(row?.timestamp || row?.created_at || row?.alert_time))
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
    .filter(isSignalRowFromToday);

  return [...liveList, ...rest];
}

export async function fetchSignalsTabPayload() {
  const [signals, liveRes] = await Promise.all([
    fetchMobileSignalsTabRows(),
    alertsService
      .fetchLiveAdvisorAlerts({limit: MOBILE_ALERTS_LIMIT, timeoutMs: API_TIMEOUT_MS.advisor})
      .catch(() => []),
  ]);
  const liveAlerts = Array.isArray(liveRes) ? liveRes : extractApiRows(liveRes);
  return buildSignalsTabRows(signals, liveAlerts);
}
