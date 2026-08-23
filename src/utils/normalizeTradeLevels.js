/** Shared ST trade-level normalization — keep in sync with mobile `normalizeTradeLevels.js`. */

export function parseTradeNumber(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'string') {
    const cleaned = value.replace(/,/g, '').replace(/[^\d.-]/g, '').trim();
    if (!cleaned) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function deriveMacdLabel(row) {
  const cross = String(row?.macd_cross || '').toLowerCase().trim();
  if (cross === 'buy' || cross === 'bull' || cross === 'bullish') return 'BUY';
  if (cross === 'sell' || cross === 'bear' || cross === 'bearish') return 'SELL';
  if (row?.macd_state) return String(row.macd_state).toUpperCase();
  const macd = parseTradeNumber(row?.macd ?? row?.macd_value ?? row?.macd_line);
  const signal = parseTradeNumber(row?.macd_signal ?? row?.macd_signal_line);
  if (macd != null && signal != null) {
    return macd >= signal ? 'BULL' : 'BEAR';
  }
  const hist = parseTradeNumber(row?.macd_histogram ?? row?.macd_hist);
  if (hist != null) return hist >= 0 ? 'BULL' : 'BEAR';
  if (macd != null) return macd >= 0 ? 'BULL' : 'BEAR';
  return '—';
}

export function deriveTradeDirection(row) {
  const tier = String(row?.buy_sell_tier || '').toUpperCase();
  if (tier.startsWith('S')) return -1;
  if (tier.startsWith('B')) return 1;
  const macdLabel = deriveMacdLabel(row);
  if (macdLabel === 'SELL' || macdLabel === 'BEAR') return -1;
  const trend = String(row?.trend || row?.signal_type || '').toLowerCase();
  if (trend.includes('bear') || trend.includes('sell')) return -1;
  return 1;
}

/**
 * Clamp/repair SL and targets so ST watchlist levels match across web and mobile.
 * Applies only when entry (or price) is a positive number.
 */
export function normalizeTradeLevels(row) {
  if (!row || typeof row !== 'object') return row;
  const entry = parseTradeNumber(row?.entry_price ?? row?.price);
  if (entry == null || entry <= 0) return row;
  const direction = deriveTradeDirection(row);
  const cmp = parseTradeNumber(row?.price) ?? entry;

  const rawSl = parseTradeNumber(row?.stop_loss);
  const rawTarget = parseTradeNumber(row?.target_short_term ?? row?.target_1);

  const minRisk = Math.max(entry * 0.005, 0.5);
  const maxRisk = Math.max(entry * 0.08, minRisk);
  const sameSideSlRisk =
    rawSl != null && ((direction > 0 && rawSl < entry) || (direction < 0 && rawSl > entry))
      ? Math.abs(entry - rawSl)
      : null;
  const inferredRisk = Math.abs(entry - cmp) * 0.6;
  const unclampedRisk = sameSideSlRisk ?? inferredRisk ?? entry * 0.02;
  const risk = Math.min(Math.max(unclampedRisk, minRisk), maxRisk);

  let stopLoss = rawSl;
  if (
    stopLoss == null
    || (direction > 0 && stopLoss >= entry)
    || (direction < 0 && stopLoss <= entry)
    || Math.abs(entry - stopLoss) > maxRisk * 1.25
  ) {
    stopLoss = Number((entry - direction * risk).toFixed(2));
  }

  let target1 = rawTarget;
  const maxTargetMove = entry * 0.25;
  const targetMove = target1 != null ? Math.abs(target1 - entry) : null;
  const invalidTargetDirection =
    target1 != null
    && ((direction > 0 && target1 <= entry) || (direction < 0 && target1 >= entry));
  const unrealisticTarget = targetMove != null && targetMove > maxTargetMove;
  if (target1 == null || invalidTargetDirection || unrealisticTarget) {
    target1 = Number((entry + direction * risk * 2.0).toFixed(2));
  }

  return {
    ...row,
    entry_price: Number(entry.toFixed(2)),
    stop_loss: Number(stopLoss.toFixed(2)),
    target_short_term: Number(target1.toFixed(2)),
    target_1: Number(target1.toFixed(2)),
  };
}

/** Apply ST trade-level normalization to a watchlist row list. */
export function normalizeWatchlistTradeLevels(rows, listType) {
  if (listType !== 'short_term' || !Array.isArray(rows)) return rows;
  return rows.map(normalizeTradeLevels);
}
