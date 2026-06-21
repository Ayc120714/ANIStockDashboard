import { fetchLatestSignals } from '../api/advisor';

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

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
  if (t === 'TARGET_DONE') return 'done';
  if (t === 'ENTRY_READY' || t.startsWith('EARLY_ENTRY_') || t.includes('ENTRY')) return 'entry_ready';
  return '';
}

export function extractTradeLevels(raw = {}) {
  const detail = raw?.signal_detail && typeof raw.signal_detail === 'object' ? raw.signal_detail : {};
  return {
    entry: numberOrNull(raw.entry_price ?? detail.entry ?? detail.entry_price),
    stopLoss: numberOrNull(raw.stop_loss ?? detail.stop_loss),
    target1: numberOrNull(raw.target_1 ?? detail.target_1 ?? detail.target_short_term),
    target2: numberOrNull(raw.target_2 ?? detail.target_2 ?? detail.target_long_term),
    cmp: numberOrNull(raw.cmp ?? detail.cmp),
    signalScore: numberOrNull(raw.signal_score ?? detail.signal_score),
  };
}

export function formatInboxPrice(value) {
  if (value == null) return '—';
  try {
    return `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } catch {
    return `₹${Number(value).toFixed(2)}`;
  }
}

export function buildInboxAlertDetail(item) {
  const raw = item?.raw || {};
  const levels = extractTradeLevels(raw);
  const status = mapLiveAlertStatus(raw);
  const alertType = String(raw.alert_type || item?.subtitle || '').trim();
  const isEntryReady = status === 'entry_ready' || String(alertType).toUpperCase() === 'ENTRY_READY';
  const hasTradeLevels = [levels.entry, levels.stopLoss, levels.target1, levels.target2].some(v => v != null);

  return {
    symbol: item?.symbol || '—',
    sourceLabel: item?.sourceLabel || item?.source || 'Alert',
    title: item?.title || 'Alert',
    subtitle: alertType || item?.subtitle || '',
    timestamp: item?.timestamp,
    message: String(raw.message || item?.title || '').trim(),
    status,
    isEntryReady,
    isLiveEntryExit: isLiveEntryExitAlert(raw),
    hasTradeLevels,
    levels,
    raw,
  };
}

export async function enrichInboxAlertDetail(item) {
  const detail = buildInboxAlertDetail(item);
  const symbol = String(detail.symbol || '').trim().toUpperCase();
  if (!symbol || symbol === '—') return detail;
  if (detail.hasTradeLevels && detail.isEntryReady) return detail;

  try {
    const rows = await fetchLatestSignals(120);
    const match = (Array.isArray(rows) ? rows : []).find((row) => {
      const sym = String(row?.symbol || '').trim().toUpperCase();
      if (sym !== symbol) return false;
      return String(row?.status || '') === 'entry_ready' || row?.entry_triggered || row?.daily_entry_triggered;
    });
    if (!match) return detail;

    const signalLevels = extractTradeLevels(match);
    const mergedLevels = {
      entry: detail.levels.entry ?? signalLevels.entry,
      stopLoss: detail.levels.stopLoss ?? signalLevels.stopLoss,
      target1: detail.levels.target1 ?? signalLevels.target1,
      target2: detail.levels.target2 ?? signalLevels.target2,
      cmp: detail.levels.cmp ?? signalLevels.cmp,
      signalScore: detail.levels.signalScore ?? signalLevels.signalScore,
    };
    const hasTradeLevels = [mergedLevels.entry, mergedLevels.stopLoss, mergedLevels.target1, mergedLevels.target2]
      .some(v => v != null);

    return {
      ...detail,
      status: detail.status || 'entry_ready',
      isEntryReady: true,
      hasTradeLevels,
      levels: mergedLevels,
      signalSource: 'advisor_setup',
    };
  } catch {
    return detail;
  }
}

export function shouldShowTradeLevels(detail) {
  if (!detail) return false;
  if (detail.isEntryReady || detail.isLiveEntryExit) return detail.hasTradeLevels;
  if (detail.raw?.entry_price != null || detail.raw?.stop_loss != null) {
    return detail.hasTradeLevels;
  }
  return false;
}
