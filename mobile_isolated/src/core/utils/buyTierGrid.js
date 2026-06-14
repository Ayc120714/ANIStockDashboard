import {compactSetupRow} from '@core/utils/advisorSetupTables';

const ALL_TIERS = ['B1', 'B2', 'B3', 'S1', 'S2', 'S3'];

function tierBlock(grid, timeframe, tier) {
  return grid?.[timeframe]?.[tier] || {count: 0, items: []};
}

/** Flatten web buy-tier-card grid into table rows (same source as TrendReversalTab). */
export function flattenBuyTierGrid(grid, {timeframe = 'weekly', tier = 'all'} = {}) {
  if (!grid?.[timeframe]) return [];
  const tiers = tier === 'all' ? ALL_TIERS : [tier];
  return tiers.flatMap(t => {
    const items = tierBlock(grid, timeframe, t).items || [];
    return items.map(row => ({
      ...row,
      buy_sell_tier: row.buy_sell_tier || t,
      timeframe,
    }));
  });
}

/** Map buy-tier grid items into compact SL/T1/T2 rows per tier (Trend reversal cards). */
export function groupBuyTierGridSetupRows(grid, levelsBySymbol, {timeframe = 'weekly'} = {}) {
  const grouped = Object.fromEntries(ALL_TIERS.map(t => [t, []]));
  if (!grid?.[timeframe]) return grouped;
  for (const tier of ALL_TIERS) {
    const items = tierBlock(grid, timeframe, tier).items || [];
    const seen = new Set();
    for (const row of items) {
      const compact = compactSetupRow(row, levelsBySymbol);
      if (!compact || seen.has(compact.symbol)) continue;
      seen.add(compact.symbol);
      grouped[tier].push(compact);
    }
  }
  return grouped;
}

/** Web TrendReversalTab row shape — full tier card fields for mobile trend tables. */
export function groupTrendReversalGridRows(grid, {timeframe = 'weekly'} = {}) {
  const grouped = Object.fromEntries(ALL_TIERS.map(t => [t, []]));
  if (!grid?.[timeframe]) return grouped;
  for (const tier of ALL_TIERS) {
    const items = tierBlock(grid, timeframe, tier).items || [];
    const seen = new Set();
    for (const row of items) {
      const symbol = String(row?.symbol || '').trim().toUpperCase();
      if (!symbol || seen.has(symbol)) continue;
      seen.add(symbol);
      grouped[tier].push({
        symbol,
        company: String(row?.company || row?.stock_name || symbol).trim(),
        sector: row?.sector || '—',
        close: row?.close,
        chg_pct: row?.chg_pct,
        volume: row?.volume,
        date: row?.date,
        buy_sell_tier: row?.buy_sell_tier || tier,
        reversal_context: row?.reversal_context,
        hold_months: row?.hold_months,
        market_cap: row?.market_cap,
        is_fresh: Boolean(row?.is_fresh),
        stop_loss: row?.stop_loss ?? null,
        target_1: row?.target_1 ?? null,
        target_2: row?.target_2 ?? null,
      });
    }
  }
  return grouped;
}
