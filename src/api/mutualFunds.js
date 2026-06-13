import { apiGet } from './apiClient';

export const fetchMutualFunds = ({
  collection = 'LONG_TERM_WEALTH_GENERATORS',
  direct_only = true,
  refresh = false,
} = {}) => {
  const params = new URLSearchParams({
    collection,
    direct_only: String(direct_only),
  });
  if (refresh) params.set('refresh', '1');
  return apiGet(`/mutual-funds/?${params}`);
};

export const fetchMfBuyTierCards = ({
  collection = 'LONG_TERM_WEALTH_GENERATORS',
  fund_limit = 100,
  refresh = false,
} = {}) => {
  const params = new URLSearchParams({
    collection,
    fund_limit: String(fund_limit),
  });
  if (refresh) params.set('refresh', 'true');
  return apiGet(`/mutual-funds/signals/buy-tier-cards?${params}`, { skipCache: true });
};

export const fetchMfRsSetup = ({
  collection = 'LONG_TERM_WEALTH_GENERATORS',
  fund_limit = 100,
  setup_mode = 'or_signal',
  refresh = false,
} = {}) => {
  const params = new URLSearchParams({
    collection,
    fund_limit: String(fund_limit),
    setup_mode,
  });
  if (refresh) params.set('refresh', 'true');
  return apiGet(`/mutual-funds/signals/rs-setup?${params}`, { skipCache: true });
};
