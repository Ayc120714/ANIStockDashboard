const TIERS = ['B1', 'B2', 'B3', 'S1', 'S2', 'S3'];

function tierBlock(items) {
  const list = Array.isArray(items) ? items : [];
  return {count: list.length, items: list};
}

export function buildTrendGrid(overrides = {}) {
  const grid = {daily: {}, weekly: {}, monthly: {}};
  for (const tf of ['daily', 'weekly', 'monthly']) {
    const tfOverrides = overrides[tf] || {};
    grid[tf] = Object.fromEntries(
      TIERS.map(tier => [
        tier,
        tierBlock(tfOverrides[tier] || []),
      ]),
    );
  }
  return grid;
}

export function sampleTrendRow(symbol = 'RELIANCE', tier = 'B1') {
  return {
    symbol,
    company: `${symbol} Ltd`,
    sector: 'Energy',
    close: 2500,
    chg_pct: 1.25,
    buy_sell_tier: tier,
    reversal_context: 'RSI reversal',
    is_fresh: true,
  };
}

export function apiTrendEnvelope(grid) {
  return {screen: 'buy_tier_card_grid', data: grid};
}

export function cachedTrendEnvelope(grid) {
  return {trendGrid: grid};
}
