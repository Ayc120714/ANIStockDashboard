/** Web FinancialAdvisorPage signals filtering (strategy + reco + conviction). */

function parseMaybeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function normalizeReco(value) {
  const v = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (v === 'strongbuy') return 'strong_buy';
  if (v === 'strongsell') return 'strong_sell';
  return v;
}

export function hasBullishMacdCross(row, timeframe = 'daily') {
  const tf = String(timeframe || 'daily').toLowerCase();
  const prefix = tf === 'daily' ? '' : `${tf}_`;
  const backendFlag = row?.[`${prefix}macd_cross_up`];
  if (typeof backendFlag === 'boolean') return backendFlag;
  const crossRaw = String(
    row?.[`${prefix}macd_cross`] ??
      row?.[`${prefix}macd_state`] ??
      row?.[`${prefix}macd_signal_state`] ??
      '',
  ).toLowerCase();
  if (crossRaw.includes('bull') || crossRaw.includes('cross_up') || crossRaw === 'up') return true;
  const macd = parseMaybeNumber(row?.[`${prefix}macd`] ?? row?.[`${prefix}macd_line`]);
  const signal = parseMaybeNumber(row?.[`${prefix}macd_signal`] ?? row?.[`${prefix}signal_line`]);
  return macd != null && signal != null && macd > signal;
}

export function hasGreenHistogramBuilding(row, timeframe = 'daily') {
  const tf = String(timeframe || 'daily').toLowerCase();
  const prefix = tf === 'daily' ? '' : `${tf}_`;
  const flipFlag = row?.[`${prefix}hist_red_to_green`];
  if (typeof flipFlag === 'boolean') return flipFlag;
  const serverFlag = row?.[`${prefix}green_hist_building`];
  if (typeof serverFlag === 'boolean') return serverFlag;
  const hist = parseMaybeNumber(row?.[`${prefix}macd_histogram`] ?? row?.[`${prefix}macd_hist`]);
  return hist != null && hist > 0;
}

export function hasMonthlyMacdBullCondition(row) {
  if (
    typeof row?.monthly_macd_positive === 'boolean' &&
    typeof row?.monthly_macd_bull_signal_condition === 'boolean'
  ) {
    return row.monthly_macd_positive && row.monthly_macd_bull_signal_condition;
  }
  const macd = parseMaybeNumber(row?.monthly_macd ?? row?.monthly_macd_value ?? row?.monthly_macd_line);
  const signal = parseMaybeNumber(row?.monthly_macd_signal ?? row?.monthly_signal ?? row?.monthly_signal_line);
  const crossUp = hasBullishMacdCross(row, 'monthly');
  return Boolean(macd != null && macd > 0 && ((signal != null && macd > signal) || crossUp));
}

export function deriveStrategyTags(row) {
  const tags = [];
  if (hasBullishMacdCross(row, 'weekly') && hasGreenHistogramBuilding(row, 'weekly')) {
    tags.push('W MACD↑');
  }
  if (row?.monthly_setup_rule || row?.monthly_psar_macd_rule || row?.monthly_qualified) {
    tags.push('M MACD+PSAR');
  }
  if (
    hasBullishMacdCross(row, 'monthly') &&
    hasGreenHistogramBuilding(row, 'monthly') &&
    hasMonthlyMacdBullCondition(row)
  ) {
    tags.push('M MACD↑');
  }
  if (row?.vwap_cross_quarter_above || row?.vwap_cross_above || row?.vwap_above_state) {
    tags.push('VWAP↑');
  }
  if (row?.vwap_cross_quarter_below || row?.vwap_cross_below || row?.vwap_below_state) {
    tags.push('VWAP↓');
  }
  return tags;
}

export function dedupeSignalsBySymbol(rows) {
  const bySymbol = new Map();
  for (const row of rows || []) {
    const symbol = String(row?.symbol || '').toUpperCase();
    if (!symbol) continue;
    const prev = bySymbol.get(symbol);
    if (!prev) {
      bySymbol.set(symbol, row);
      continue;
    }
    const prevScore = Number(prev.conviction_score ?? prev.signal_score ?? Number.NEGATIVE_INFINITY);
    const curScore = Number(row.conviction_score ?? row.signal_score ?? Number.NEGATIVE_INFINITY);
    if (curScore > prevScore) bySymbol.set(symbol, row);
  }
  return Array.from(bySymbol.values());
}

export function filterAdvisorSignals(
  signalData = [],
  monthlySetupData = [],
  {strategyFilter = 'all', recoFilter = 'all', convFilter = 'all', symbolQuery = ''} = {},
) {
  let rows = dedupeSignalsBySymbol(signalData).filter(s => s.cmp && s.entry_price && !s.hit_target);

  if (symbolQuery) {
    const q = symbolQuery.toUpperCase();
    rows = rows.filter(s => String(s.symbol || '').toUpperCase().includes(q));
  }

  if (convFilter === 'high') {
    rows = rows.filter(s => s.high_conviction);
  }

  if (recoFilter !== 'all') {
    rows = rows.filter(s => normalizeReco(s.signal_type || s.recommendation) === recoFilter);
  }

  if (strategyFilter === 'monthly_psar_macd') {
    rows = rows.filter(s => s.monthly_setup_rule || s.monthly_psar_macd_rule || s.monthly_qualified);
  } else if (strategyFilter === 'macd_cross_up_weekly') {
    rows = rows.filter(s => hasBullishMacdCross(s, 'weekly') && hasGreenHistogramBuilding(s, 'weekly'));
  } else if (strategyFilter === 'macd_cross_up_monthly') {
    rows = rows.filter(
      s =>
        (hasBullishMacdCross(s, 'monthly') &&
          hasGreenHistogramBuilding(s, 'monthly') &&
          hasMonthlyMacdBullCondition(s)) ||
        s.monthly_setup_rule ||
        s.monthly_psar_macd_rule ||
        s.monthly_qualified,
    );
  } else if (strategyFilter === 'vwap_cross_above') {
    rows = rows.filter(s => s.vwap_cross_quarter_above || s.vwap_cross_above || s.vwap_above_state);
  } else if (strategyFilter === 'vwap_cross_below') {
    rows = rows.filter(s => s.vwap_cross_quarter_below || s.vwap_cross_below || s.vwap_below_state);
  }

  return dedupeSignalsBySymbol(rows);
}

/** Keep the latest alert per symbol (newest timestamp, then highest score). */
export function dedupeAlertsBySymbol(rows) {
  const bySymbol = new Map();
  for (const row of rows || []) {
    const symbol = String(row?.symbol || '').trim().toUpperCase();
    if (!symbol) continue;
    const prev = bySymbol.get(symbol);
    if (!prev) {
      bySymbol.set(symbol, row);
      continue;
    }
    const prevTs = Date.parse(prev.timestamp || prev.created_at || '') || 0;
    const curTs = Date.parse(row.timestamp || row.created_at || '') || 0;
    if (curTs > prevTs) {
      bySymbol.set(symbol, row);
      continue;
    }
    if (curTs === prevTs) {
      const prevScore = Number(prev.signal_score ?? Number.NEGATIVE_INFINITY);
      const curScore = Number(row.signal_score ?? Number.NEGATIVE_INFINITY);
      if (curScore > prevScore) bySymbol.set(symbol, row);
    }
  }
  return Array.from(bySymbol.values()).sort((a, b) => {
    const ta = Date.parse(a.timestamp || a.created_at || '') || 0;
    const tb = Date.parse(b.timestamp || b.created_at || '') || 0;
    return tb - ta;
  });
}

export const ADVISOR_STRATEGY_OPTIONS = [
  {id: 'all', label: 'All Strategies'},
  {id: 'custom_rs_or_signal', label: 'RS+EMA + (MACD W|M | PSAR | RVOL)'},
  {id: 'custom_rs_strict', label: 'Strict: RS cross + MACD W&M + PSAR + RVOL'},
  {id: 'monthly_psar_macd', label: 'Monthly MACD+PSAR'},
  {id: 'macd_cross_up_weekly', label: 'Weekly MACD Cross + Red->Green Hist'},
  {id: 'macd_cross_up_monthly', label: 'Monthly MACD Cross + Red->Green Hist'},
  {id: 'vwap_cross_above', label: 'VWAP Cross Above'},
  {id: 'vwap_cross_below', label: 'VWAP Cross Below'},
];

export const ADVISOR_RECO_OPTIONS = [
  {id: 'all', label: 'All Reco'},
  {id: 'strong_buy', label: 'Strong Buy'},
  {id: 'buy', label: 'Buy'},
  {id: 'hold', label: 'Hold'},
  {id: 'sell', label: 'Sell'},
  {id: 'strong_sell', label: 'Strong Sell'},
];
