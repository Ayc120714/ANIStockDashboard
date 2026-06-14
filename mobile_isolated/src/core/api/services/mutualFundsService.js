import {apiGet} from '@core/api/apiClient';

export const mutualFundsService = {
  fetchFunds: ({collection, direct_only = true, refresh = false} = {}) => {
    const params = new URLSearchParams({
      collection: collection || 'LONG_TERM_WEALTH_GENERATORS',
      direct_only: String(direct_only),
    });
    if (refresh) params.set('refresh', '1');
    return apiGet(`/mutual-funds/?${params}`);
  },
  fetchBuyTierCards: ({collection, fund_limit = 100, refresh = false} = {}) => {
    const params = new URLSearchParams({
      collection: collection || 'LONG_TERM_WEALTH_GENERATORS',
      fund_limit: String(fund_limit),
    });
    if (refresh) params.set('refresh', 'true');
    return apiGet(`/mutual-funds/signals/buy-tier-cards?${params}`);
  },
  fetchRsSetup: ({collection, fund_limit = 100, setup_mode = 'or_signal', refresh = false} = {}) => {
    const params = new URLSearchParams({
      collection: collection || 'LONG_TERM_WEALTH_GENERATORS',
      fund_limit: String(fund_limit),
      setup_mode,
    });
    if (refresh) params.set('refresh', 'true');
    return apiGet(`/mutual-funds/signals/rs-setup?${params}`);
  },
};

const retAnn = bucket => (bucket && bucket.annualised != null ? bucket.annualised : null);

export function mapFundListRows(funds = []) {
  return (funds || []).map(f => ({
    ...f,
    ret_1y: retAnn(f.returns?.['1Y']),
    ret_3y: retAnn(f.returns?.['3Y']),
    ret_5y: retAnn(f.returns?.['5Y']),
    ret_10y: retAnn(f.returns?.['10Y']),
  }));
}

export function flattenTierRows(grid) {
  if (!grid) return [];
  const out = [];
  for (const tf of ['daily', 'weekly', 'monthly']) {
    const block = grid[tf];
    if (!block) continue;
    for (const tier of ['B1', 'B2', 'B3', 'S1', 'S2', 'S3']) {
      const rows = block[tier];
      if (!Array.isArray(rows)) continue;
      for (const row of rows) {
        out.push({...row, timeframe: tf, buy_sell_tier: tier});
      }
    }
  }
  return out;
}
