function parseNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function deriveSetupDirection(row) {
  const tier = String(row?.buy_sell_tier || '').toUpperCase();
  if (tier.startsWith('S')) return -1;
  if (tier.startsWith('B')) return 1;
  const trend = String(row?.trend || row?.signal_type || '').toLowerCase();
  if (trend.includes('bear') || trend.includes('sell')) return -1;
  const alertType = String(row?._alertType || row?.alert_type || '').toLowerCase();
  if (alertType.includes('sell') || alertType.includes('bear') || alertType.includes('exit')) return -1;
  return 1;
}

/** Lifecycle for live setup board — remove row when SL or T2 is hit. */
export function getSetupLifecycleState(row) {
  const cmp = parseNumber(row?.cmp ?? row?.price);
  const entry = parseNumber(row?.entry_price);
  const stopLoss = parseNumber(row?.stop_loss);
  const t1 = parseNumber(row?.target_1 ?? row?.target_short_term);
  const t2 = parseNumber(row?.target_2 ?? row?.next_scope_target);
  const direction = deriveSetupDirection(row);
  const isBull = direction >= 0;

  if (cmp == null || entry == null) {
    return {
      isBull,
      stopHit: false,
      t2Hit: false,
      t1Hit: false,
      shouldRemove: false,
      statusLabel: 'WAIT DATA',
    };
  }

  const t1Hit = t1 != null && (isBull ? cmp >= t1 : cmp <= t1);
  const effectiveStopLoss = t1Hit && entry != null ? entry : stopLoss;
  const stopHit = effectiveStopLoss != null && (isBull ? cmp <= effectiveStopLoss : cmp >= effectiveStopLoss);
  const t2Hit = t2 != null && (isBull ? cmp >= t2 : cmp <= t2);

  const alertType = String(row?._alertType || row?.alert_type || '').toUpperCase();
  const status = String(row?.status || '').toLowerCase();
  const closedByAlert = alertType === 'TARGET_DONE' || alertType === 'STOP_LOSS_HIT' || status === 'done';

  const shouldRemove = stopHit || t2Hit || closedByAlert;

  let statusLabel = 'ACTIVE';
  if (t2Hit || closedByAlert) statusLabel = 'T2 / DONE';
  else if (stopHit) statusLabel = 'SL HIT';
  else if (t1Hit) statusLabel = 'T1 HIT';
  else if (String(row?.status || '') === 'entry_ready') statusLabel = 'ENTRY READY';
  else if (String(row?.status || '') === 'in_trade') statusLabel = 'IN TRADE';

  return {
    isBull,
    stopHit,
    t2Hit,
    t1Hit,
    effectiveStopLoss,
    shouldRemove,
    statusLabel,
  };
}

export function shouldRemoveSetupRow(row) {
  return getSetupLifecycleState(row).shouldRemove;
}

export function setupRowToTradeDetail(row) {
  return {
    symbol: row?.symbol,
    isEntryReady: String(row?.status || '') === 'entry_ready' || String(row?._alertType || '').includes('ENTRY'),
    hasTradeLevels: true,
    isLiveEntryExit: Boolean(row?._liveAlert),
    levels: {
      entry: row?.entry_price,
      stopLoss: row?.stop_loss,
      target1: row?.target_1,
      target2: row?.target_2,
      cmp: row?.cmp,
      signalScore: row?.signal_score ?? row?.conviction_score,
    },
    raw: row,
    trend: row?.trend,
    title: row?._alertMessage || row?.message || `${row?.symbol || 'Setup'} alert`,
    subtitle: row?._alertType || row?.status || 'setup',
  };
}
