import { apiGet } from './apiClient';

/** 5m bullish volume + daily-reset CVD screener. */
export const fetchBullishVolume5m = async ({
  limit = 300,
  result_limit = 100,
  universe = 'sector',
  symbols = '',
  vol_ratio_min = 2,
  vol_ema_period = 21,
  lookback_days = 12,
  min_bars = 200,
  require_cvd = true,
  refresh = false,
} = {}) => {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('result_limit', String(result_limit));
  params.set('universe', String(universe));
  params.set('vol_ratio_min', String(vol_ratio_min));
  params.set('vol_ema_period', String(vol_ema_period));
  params.set('lookback_days', String(lookback_days));
  params.set('min_bars', String(min_bars));
  params.set('require_cvd', require_cvd ? 'true' : 'false');
  if (symbols && String(symbols).trim()) params.set('symbols', String(symbols).trim());
  if (refresh) params.set('refresh', 'true');
  return apiGet(`/advisor/signals/bullish-volume-5m?${params.toString()}`);
};
