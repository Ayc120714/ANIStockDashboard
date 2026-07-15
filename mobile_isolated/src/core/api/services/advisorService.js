import {apiGet, apiRequest} from '@core/api/apiClient';
import {API_TIMEOUT_MS} from '@core/config/apiTimeouts';
import {
  parseAdvisorListResponse,
  parseWeeklyEntriesResponse,
} from '@core/utils/webParity';

const T = API_TIMEOUT_MS.advisor;

const toQuery = params => {
  const q = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.append(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : '';
};

export const advisorService = {
  fetchRatings: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.recommendation) params.set('recommendation', filters.recommendation);
    if (filters.horizon) params.set('horizon', filters.horizon);
    if (filters.limit) params.set('limit', String(filters.limit));
    const qs = params.toString();
    const resp = await apiGet(`/advisor/ratings${qs ? `?${qs}` : ''}`, {timeoutMs: filters.timeoutMs ?? T});
    return parseAdvisorListResponse(resp);
  },
  fetchAdvisorWeeklyEntries: async ({
    limit = 25,
    max_entry_gap_pct = 5,
    signal_limit = 250,
    timeoutMs,
  } = {}) => {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('max_entry_gap_pct', String(max_entry_gap_pct));
    params.set('signal_limit', String(signal_limit));
    return parseWeeklyEntriesResponse(
      await apiGet(`/advisor/signals/weekly-entries?${params.toString()}`, {timeoutMs: timeoutMs ?? T}),
    );
  },
  fetchLatestSignalsPayload: (params = {}) => {
    const q = new URLSearchParams();
    q.set('limit', String(params.limit ?? 200));
    if (params.max_entry_gap_pct != null) {
      q.set('max_entry_gap_pct', String(params.max_entry_gap_pct));
    }
    if (params.monthly_entry_only) {
      q.set('monthly_entry_only', 'true');
    }
    return apiGet(`/advisor/signals/latest?${q.toString()}`, {timeoutMs: params.timeoutMs ?? T});
  },
  fetchMonthlyMacdSetup: async (limit = 300, opts = {}) =>
    parseAdvisorListResponse(
      await apiGet(`/advisor/monthly-macd-setup?limit=${limit}`, {timeoutMs: opts.timeoutMs ?? T}),
    ),
  fetchCustomRsMacdSetup: async ({limit = 400, setup_mode = 'or_signal', refresh = false, timeoutMs} = {}) =>
    parseAdvisorListResponse(
      await apiGet(
        `/advisor/signals/custom-rs-macd-weekly-setup${toQuery({
          limit,
          setup_mode,
          ...(refresh ? {refresh: 'true'} : {}),
        })}`,
        {timeoutMs: timeoutMs ?? T},
      ),
    ),
  fetchMondayPrevWeekHighCross: async ({limit = 500, refresh = false, timeoutMs} = {}) =>
    parseAdvisorListResponse(
      await apiGet(
        `/advisor/signals/monday-prev-week-high-cross${toQuery({
          limit,
          universe: 'all',
          require_cross: 'true',
          ...(refresh ? {refresh: 'true'} : {}),
        })}`,
        {timeoutMs: timeoutMs ?? T},
      ),
    ),
  fetchAnalysis: (symbol, limit = 10, opts = {}) =>
    apiGet(`/advisor/analysis/${encodeURIComponent(symbol)}${toQuery({limit})}`, {
      timeoutMs: opts.timeoutMs ?? T,
    }),
  triggerAnalyze: (symbol, analysisType = 'earnings') =>
    apiRequest(`/advisor/analyze/${encodeURIComponent(symbol)}${toQuery({analysis_type: analysisType})}`, {
      method: 'POST',
    }),
  fetchPortfolioHealth: (symbols, opts = {}) =>
    apiGet(`/advisor/portfolio-health${toQuery({symbols: String(symbols || '').trim()})}`, {
      timeoutMs: opts.timeoutMs ?? T,
    }),
  fetchIndicatorScreener: ({
    timeframe = 'weekly',
    indicator = 'rsi',
    condition = 'cross_above',
    value = 50,
    universe = 'watchlist',
    limit = 150,
    timeoutMs,
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
      {timeoutMs: timeoutMs ?? T},
    ),
  fetchBuyTierCardGrid: ({refresh = false, symbol_limit = 800, lite = true, timeoutMs} = {}) =>
    apiGet(
      `/advisor/signals/buy-tier-cards${toQuery({
        symbol_limit,
        lite: lite ? 'true' : 'false',
        ...(refresh ? {refresh: 'true'} : {}),
      })}`,
      {timeoutMs: timeoutMs ?? T},
    ),
  fetchChartFundamentalAgent: ({
    refresh = false,
    limit = 300,
    symbol_limit = 800,
    rvol_min = 1.2,
    scan_profile = 'chartink_rs_daily',
    min_gates = 4,
    include_partial = false,
    timeoutMs,
  } = {}) =>
    apiGet(
      `/advisor/signals/chart-fundamental-agent${toQuery({
        limit,
        symbol_limit,
        rvol_min,
        scan_profile,
        min_gates,
        ...(include_partial ? {include_partial: 'true'} : {}),
        ...(refresh ? {refresh: 'true'} : {}),
      })}`,
      {timeoutMs: timeoutMs ?? T},
    ),
  fetchRsRvolEma5mSignals: async ({
    limit = 500,
    symbol_limit = 1500,
    rvol_min = 1.5,
    refresh = false,
    timeoutMs,
  } = {}) =>
    apiGet(
      `/advisor/signals/rs-rvol-ema5m${toQuery({
        limit,
        symbol_limit,
        rvol_min,
        ...(refresh ? {refresh: 'true'} : {}),
      })}`,
      {timeoutMs: timeoutMs ?? T},
    ),
  fetchEarlyDetectionRecent: async ({
    lookback_days = null,
    timeframe = 'daily',
    limit = 300,
    dedupe_symbol = true,
    sqz_set = '',
    sort_by = 'wealth_rank',
    sort_dir = 'desc',
    timeoutMs,
  } = {}) =>
    apiGet(
      `/advisor/signals/early-detection/recent${toQuery({
        timeframe,
        limit,
        dedupe_symbol: dedupe_symbol ? 'true' : 'false',
        sort_by,
        sort_dir,
        ...(lookback_days != null ? {lookback_days} : {}),
        ...(sqz_set && sqz_set !== 'all' ? {sqz_set} : {}),
      })}`,
      {timeoutMs: timeoutMs ?? T},
    ),
  fetchEarlyDetectionHistory: async ({
    from_date,
    to_date,
    timeframe = 'daily',
    limit = 1000,
    sqz_set = '',
    sort_by = 'wealth_rank',
    sort_dir = 'desc',
    timeoutMs,
  } = {}) =>
    apiGet(
      `/advisor/signals/early-detection/history${toQuery({
        timeframe,
        from_date: String(from_date || '').slice(0, 10),
        to_date: String(to_date || '').slice(0, 10),
        limit,
        sort_by,
        sort_dir,
        ...(sqz_set && sqz_set !== 'all' ? {sqz_set} : {}),
      })}`,
      {timeoutMs: timeoutMs ?? T},
    ),
};
