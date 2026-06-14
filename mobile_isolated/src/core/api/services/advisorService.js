import {apiGet, apiRequest} from '@core/api/apiClient';

const toQuery = params => {
  const q = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.append(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : '';
};

export const advisorService = {
  fetchLatestSignalsPayload: (params = {}) => {
    const q = new URLSearchParams();
    q.set('limit', String(params.limit ?? 200));
    if (params.max_entry_gap_pct != null) {
      q.set('max_entry_gap_pct', String(params.max_entry_gap_pct));
    }
    if (params.monthly_entry_only) {
      q.set('monthly_entry_only', 'true');
    }
    return apiGet(`/advisor/signals/latest?${q.toString()}`, {timeoutMs: params.timeoutMs ?? 60_000});
  },
  fetchMonthlyMacdSetup: (limit = 300) =>
    apiGet(`/advisor/monthly-macd-setup?limit=${limit}`, {timeoutMs: 45_000}),
  fetchCustomRsMacdSetup: ({limit = 400, setup_mode = 'or_signal', refresh = false} = {}) =>
    apiGet(
      `/advisor/signals/custom-rs-macd-weekly-setup${toQuery({
        limit,
        setup_mode,
        ...(refresh ? {refresh: 'true'} : {}),
      })}`,
      {timeoutMs: 45_000},
    ),
  fetchMondayPrevWeekHighCross: ({limit = 500, refresh = false} = {}) =>
    apiGet(
      `/advisor/signals/monday-prev-week-high-cross${toQuery({
        limit,
        universe: 'all',
        require_cross: 'true',
        ...(refresh ? {refresh: 'true'} : {}),
      })}`,
      {timeoutMs: 45_000},
    ),
  fetchAnalysis: (symbol, limit = 10) =>
    apiGet(`/advisor/analysis/${encodeURIComponent(symbol)}${toQuery({limit})}`),
  triggerAnalyze: (symbol, analysisType = 'earnings') =>
    apiRequest(`/advisor/analyze/${encodeURIComponent(symbol)}${toQuery({analysis_type: analysisType})}`, {
      method: 'POST',
    }),
  fetchPortfolioHealth: symbols =>
    apiGet(`/advisor/portfolio-health${toQuery({symbols: String(symbols || '').trim()})}`),
  fetchIndicatorScreener: ({
    timeframe = 'weekly',
    indicator = 'rsi',
    condition = 'cross_above',
    value = 50,
    universe = 'watchlist',
    limit = 150,
  } = {}) =>
    apiGet(
      `/advisor/signals/indicator-screener${toQuery({
        timeframe,
        indicator,
        condition,
        value,
        universe,
        limit,
      })}`,
      {timeoutMs: 45_000},
    ),
};
