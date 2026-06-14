/** Compact advisor setup tables: Symbol · SL · T1 · T2 only. */

export const TIER_SETUPS = [
  {id: 'B1', label: 'B1 · Buy tier 1', tier: 'B1', tone: 'bull'},
  {id: 'B2', label: 'B2 · Buy tier 2', tier: 'B2', tone: 'bull'},
  {id: 'B3', label: 'B3 · Buy tier 3', tier: 'B3', tone: 'bull'},
  {id: 'S1', label: 'S1 · Sell tier 1', tier: 'S1', tone: 'bear'},
  {id: 'S2', label: 'S2 · Sell tier 2', tier: 'S2', tone: 'bear'},
  {id: 'S3', label: 'S3 · Sell tier 3', tier: 'S3', tone: 'bear'},
];

export const EXTRA_SETUPS = [
  {id: 'monthly_setup', label: 'Monthly MACD setup', source: 'monthly'},
  {id: 'custom_rs', label: 'Custom RS / MACD screen', source: 'custom'},
  {id: 'monday_pwh', label: 'Monday close above prior week high', source: 'monday'},
  {id: 'other', label: 'Other live signals', tier: '__other__'},
];

export const ALL_SETUP_IDS = [
  ...TIER_SETUPS.map(s => s.id),
  ...EXTRA_SETUPS.map(s => s.id),
];

export function buildLevelsLookup(rows) {
  const map = new Map();
  for (const row of rows || []) {
    const sym = String(row?.symbol || '').trim().toUpperCase();
    if (!sym) continue;
    if (!map.has(sym)) {
      map.set(sym, {
        stop_loss: row.stop_loss,
        target_1: row.target_1,
        target_2: row.target_2,
      });
    }
  }
  return map;
}

export function compactSetupRow(row, levelsBySymbol) {
  const symbol = String(row?.symbol || '').trim().toUpperCase();
  if (!symbol) return null;
  const fallback = levelsBySymbol?.get(symbol) || {};
  return {
    symbol,
    stop_loss: row?.stop_loss ?? fallback.stop_loss ?? null,
    target_1: row?.target_1 ?? fallback.target_1 ?? null,
    target_2: row?.target_2 ?? fallback.target_2 ?? null,
  };
}

export function groupLatestSignalsByTier(rows, levelsBySymbol) {
  const grouped = Object.fromEntries(TIER_SETUPS.map(s => [s.id, []]));
  grouped.other = [];

  for (const row of rows || []) {
    const tier = String(row?.buy_sell_tier || '').trim().toUpperCase();
    const compact = compactSetupRow(row, levelsBySymbol);
    if (!compact) continue;
    if (grouped[tier]) {
      grouped[tier].push(compact);
    } else {
      grouped.other.push(compact);
    }
  }

  return grouped;
}

export function mapSetupRows(rows, levelsBySymbol) {
  const out = [];
  const seen = new Set();
  for (const row of rows || []) {
    const compact = compactSetupRow(row, levelsBySymbol);
    if (!compact || seen.has(compact.symbol)) continue;
    seen.add(compact.symbol);
    out.push(compact);
  }
  return out;
}

export function setupHasRows(setupId, grouped) {
  if (setupId === 'other') return (grouped?.other?.length || 0) > 0;
  return (grouped?.[setupId]?.length || 0) > 0;
}
