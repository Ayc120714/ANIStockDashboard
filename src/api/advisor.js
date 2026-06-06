import { apiGet, apiPost, apiRequest } from './apiClient';

export const fetchRatings = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.recommendation) params.set('recommendation', filters.recommendation);
  if (filters.horizon) params.set('horizon', filters.horizon);
  if (filters.limit) params.set('limit', filters.limit);
  const qs = params.toString();
  const data = await apiGet(`/advisor/ratings${qs ? '?' + qs : ''}`);
  return data?.data ?? [];
};

export const fetchRating = async (symbol) => {
  return apiGet(`/advisor/ratings/${symbol}`);
};

export const fetchLatestSignals = async (limit = 50) => {
  const data = await apiGet(`/advisor/signals/latest?limit=${limit}`);
  return data?.data ?? [];
};

export const fetchLatestSignalsPayload = async (limit = 50) => {
  return apiGet(`/advisor/signals/latest?limit=${limit}`);
};

export const fetchMonthlyMacdSetup = async (limit = 200) => {
  const data = await apiGet(`/advisor/monthly-macd-setup?limit=${limit}`);
  return data?.data ?? [];
};

/** Super-admin: user's next-week monitor symbol list. */
export const fetchNextWeekMonitorSymbols = async () =>
  apiGet('/advisor/signals/next-week-setup/monitor-symbols');

export const saveNextWeekMonitorSymbols = async (symbols) =>
  apiRequest('/advisor/signals/next-week-setup/monitor-symbols', {
    method: 'PUT',
    body: JSON.stringify({ symbols: symbols || [] }),
  });

/** Super-admin: monitor list + live rows for the Next Week Setup page. */
export const fetchNextWeekMonitorDashboard = async ({ trade_ready_only = false, timeframe = 'daily' } = {}) => {
  const params = new URLSearchParams();
  params.set('timeframe', String(timeframe || 'daily'));
  params.set('trade_ready_only', trade_ready_only ? 'true' : 'false');
  return apiGet(`/advisor/signals/next-week-setup/monitor-dashboard?${params.toString()}`);
};

/** Live next-week setup rows (WebSocket screener worker). */
export const fetchNextWeekSetupLive = async ({
  timeframe = 'daily',
  min_step = null,
  trade_ready_only = false,
  limit = 500,
} = {}) => {
  const params = new URLSearchParams();
  params.set('timeframe', String(timeframe || 'daily'));
  params.set('limit', String(limit));
  params.set('trade_ready_only', trade_ready_only ? 'true' : 'false');
  if (min_step != null && min_step !== '') params.set('min_step', String(min_step));
  return apiGet(`/advisor/signals/next-week-setup/live?${params.toString()}`);
};

export const fetchNextWeekSetupStatus = async () =>
  apiGet('/advisor/signals/next-week-setup/status');

/** Recent early-detection signals (public-safe API payload). */
export const fetchEarlyDetectionRecent = async ({
  lookback_days = null,
  timeframe = 'daily',
  limit = 500,
  dedupe_symbol = true,
  sqz_set = '',
  sort_by = 'trigger_date',
  sort_dir = 'desc',
} = {}) => {
  const params = new URLSearchParams();
  params.set('timeframe', String(timeframe || 'daily'));
  params.set('limit', String(limit));
  params.set('dedupe_symbol', dedupe_symbol ? 'true' : 'false');
  params.set('sort_by', String(sort_by || 'trigger_date'));
  params.set('sort_dir', String(sort_dir || 'desc'));
  if (lookback_days != null && lookback_days !== '') {
    params.set('lookback_days', String(lookback_days));
  }
  const sqz = String(sqz_set || '').trim().toLowerCase();
  if (sqz && sqz !== 'all') params.set('sqz_set', sqz);
  return apiGet(`/advisor/signals/early-detection/recent?${params.toString()}`);
};

/** Early-detection rows for a selected date range (history view). */
export const fetchEarlyDetectionHistory = async ({
  from_date,
  to_date,
  timeframe = 'daily',
  limit = 2000,
  sqz_set = '',
  sort_by = 'trigger_date',
  sort_dir = 'desc',
} = {}) => {
  const params = new URLSearchParams();
  params.set('timeframe', String(timeframe || 'daily'));
  params.set('from_date', String(from_date || '').slice(0, 10));
  params.set('to_date', String(to_date || '').slice(0, 10));
  params.set('limit', String(limit));
  params.set('sort_by', String(sort_by || 'trigger_date'));
  params.set('sort_dir', String(sort_dir || 'desc'));
  const sqz = String(sqz_set || '').trim().toLowerCase();
  if (sqz && sqz !== 'all') params.set('sqz_set', sqz);
  return apiGet(`/advisor/signals/early-detection/history?${params.toString()}`);
};

/** Recompute setup for selected dates (optional single symbol). */
export const fetchEarlyDetectionVerify = async ({
  from_date,
  to_date,
  timeframe = 'daily',
  symbol = '',
  universe = 'sector',
  symbol_limit = 400,
  sqz_set = '',
  sort_by = 'trigger_date',
  sort_dir = 'desc',
} = {}) => {
  const params = new URLSearchParams();
  params.set('timeframe', String(timeframe || 'daily'));
  params.set('from_date', String(from_date || '').slice(0, 10));
  params.set('to_date', String(to_date || '').slice(0, 10));
  params.set('universe', String(universe || 'sector'));
  params.set('symbol_limit', String(symbol_limit));
  params.set('sort_by', String(sort_by || 'trigger_date'));
  params.set('sort_dir', String(sort_dir || 'desc'));
  const sym = String(symbol || '').trim().toUpperCase();
  if (sym) params.set('symbol', sym);
  const sqz = String(sqz_set || '').trim().toLowerCase();
  if (sqz && sqz !== 'all') params.set('sqz_set', sqz);
  return apiGet(`/advisor/signals/early-detection/verify?${params.toString()}`);
};

/** Monday close above prior calendar week's high (optional cross from prior session). */
export const fetchMondayPrevWeekHighCross = async ({
  limit = 500,
  refresh = false,
  universe = 'all',
  as_of = '',
  monday_date = '',
  require_cross = true,
} = {}) => {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('universe', String(universe || 'all'));
  if (refresh) params.set('refresh', 'true');
  if (as_of && String(as_of).trim()) params.set('as_of', String(as_of).trim());
  if (monday_date && String(monday_date).trim()) params.set('monday_date', String(monday_date).trim());
  if (!require_cross) params.set('require_cross', 'false');
  return apiGet(`/advisor/signals/monday-prev-week-high-cross?${params.toString()}`);
};

/** Custom RS / MACD / PSAR / RVOL screen (`setup_mode`: strict | or_signal). */
export const fetchCustomRsMacdSetup = async ({
  limit = 400,
  setup_mode = 'or_signal',
  refresh = false,
} = {}) => {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('setup_mode', String(setup_mode || 'or_signal'));
  if (refresh) params.set('refresh', 'true');
  return apiGet(`/advisor/signals/custom-rs-macd-weekly-setup?${params.toString()}`);
};

/** Trend reversal: tier S↔B (``buy_sell_tier``), legacy RSI+MACD, Pine DMI on OHLC (``technical_signals`` + candles). */
export const fetchTrendReversal = async ({
  timeframe = 'daily',
  refresh = false,
  symbol_limit = 120,
  require_screener_crosses = true,
  include_multi_summary = false,
  buy_tier = '',
} = {}) => {
  const params = new URLSearchParams();
  params.set('timeframe', String(timeframe || 'daily'));
  params.set('symbol_limit', String(symbol_limit));
  params.set('require_screener_crosses', require_screener_crosses ? 'true' : 'false');
  if (include_multi_summary) params.set('include_multi_summary', 'true');
  const bt = String(buy_tier || '').trim().toUpperCase();
  if (bt === 'B1' || bt === 'B2' || bt === 'B3') params.set('buy_tier', bt);
  if (refresh) params.set('refresh', 'true');
  return apiGet(`/advisor/signals/trend-reversal?${params.toString()}`);
};

/** Daily / weekly / monthly × B1 B2 B3 — latest-bar buy_sell_tier buckets (card grid). */
export const fetchBuyTierCardGrid = async ({ refresh = false, symbol_limit = 800 } = {}) => {
  const params = new URLSearchParams();
  params.set('symbol_limit', String(symbol_limit));
  if (refresh) params.set('refresh', 'true');
  return apiGet(`/advisor/signals/buy-tier-cards?${params.toString()}`);
};

export const fetchLiveScreenerSignals = async ({
  limit = 150,
  symbols = '',
  sendTelegram = false,
  refresh = false,
} = {}) => {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  if (symbols && String(symbols).trim()) params.set('symbols', String(symbols).trim());
  if (sendTelegram) params.set('send_telegram', 'true');
  if (refresh) params.set('refresh', 'true');
  const data = await apiGet(`/advisor/signals/live-screener?${params.toString()}`);
  return data ?? { count: 0, data: [], cached: false, scan_symbols: 0 };
};

export const fetchIndicatorScreenerSignals = async ({
  timeframe = 'monthly',
  indicator = 'rsi',
  condition = 'cross_above',
  value = null,
  compareIndicator = '',
  universe = 'all',
  symbols = '',
  limit = 200,
  sendTelegram = false,
  refresh = true,
} = {}) => {
  const params = new URLSearchParams();
  params.set('timeframe', String(timeframe || 'monthly'));
  params.set('universe', String(universe || 'all'));
  params.set('indicator', String(indicator || 'rsi'));
  params.set('condition', String(condition || 'cross_above'));
  params.set('limit', String(limit));
  if (value !== null && value !== undefined && String(value).trim() !== '') {
    params.set('value', String(value));
  }
  if (compareIndicator && String(compareIndicator).trim()) {
    params.set('compare_indicator', String(compareIndicator).trim());
  }
  if (symbols && String(symbols).trim()) {
    params.set('symbols', String(symbols).trim());
  }
  if (sendTelegram) params.set('send_telegram', 'true');
  if (refresh) params.set('refresh', 'true');
  const data = await apiGet(`/advisor/signals/indicator-screener?${params.toString()}`);
  return data ?? { count: 0, data: [], cached: false, scan_symbols: 0 };
};

export const fetchIndicatorScreenerMultiSignals = async ({
  timeframe = 'monthly',
  rules = [],
  universe = 'all',
  symbols = '',
  limit = 200,
  sendTelegram = false,
  refresh = true,
  cacheTtlSec = 45,
} = {}) => {
  const data = await apiPost('/advisor/signals/indicator-screener/multi', {
    timeframe,
    rules,
    universe,
    symbols,
    limit,
    send_telegram: sendTelegram,
    refresh,
    cache_ttl_sec: cacheTtlSec,
  });
  return data ?? { count: 0, data: [], cached: false, scan_symbols: 0, rules: [] };
};

export const fetchAgentSupervisorSignals = async ({
  timeframe = 'daily',
  universe = 'all',
  symbols = '',
  side = 'all',
  minConfidence = 50,
  limit = 200,
} = {}) => {
  const params = new URLSearchParams();
  params.set('timeframe', String(timeframe || 'daily'));
  params.set('universe', String(universe || 'all'));
  params.set('side', String(side || 'all'));
  params.set('min_confidence', String(minConfidence));
  params.set('limit', String(limit));
  if (symbols && String(symbols).trim()) {
    params.set('symbols', String(symbols).trim());
  }
  const data = await apiGet(`/advisor/signals/agent-supervisor?${params.toString()}`);
  return data ?? { count: 0, data: [], rule: {} };
};

export const fetchVideoStrategySignals = async ({
  limit = 200,
  symbols = '',
  universe = 'all',
  side = 'both',
  relVolThreshold = 2.0,
  displacementMult = 1.8,
  levelToleranceBps = 8.0,
  sendTelegram = false,
  refresh = false,
  cacheTtlSec = 180,
} = {}) => {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('universe', String(universe || 'all'));
  params.set('side', String(side || 'both'));
  params.set('rel_vol_threshold', String(relVolThreshold));
  params.set('displacement_mult', String(displacementMult));
  params.set('level_tolerance_bps', String(levelToleranceBps));
  params.set('cache_ttl_sec', String(cacheTtlSec));
  if (symbols && String(symbols).trim()) {
    params.set('symbols', String(symbols).trim());
  }
  if (sendTelegram) params.set('send_telegram', 'true');
  if (refresh) params.set('refresh', 'true');
  const data = await apiGet(`/advisor/signals/video-strategies?${params.toString()}`);
  return data ?? { count: 0, data: [], cached: false, scan_symbols: 0 };
};

export const fetchSignals = async (symbol, limit = 10) => {
  const data = await apiGet(`/advisor/signals/${symbol}?limit=${limit}`);
  return data?.data ?? [];
};

export const fetchFundamentals = async (symbol) => {
  const data = await apiGet(`/advisor/fundamentals/${symbol}`);
  return data?.data ?? [];
};

export const fetchAnalysis = async (symbol) => {
  const data = await apiGet(`/advisor/analysis/${symbol}`);
  return data?.data ?? [];
};

export const fetchAnalysisBrief = async (symbol, analysisType = 'earnings') => {
  try {
    return await apiGet(`/advisor/analysis/${encodeURIComponent(symbol)}/brief?analysis_type=${encodeURIComponent(analysisType)}`);
  } catch (e) {
    if (String(e?.message || '').includes('404')) return null;
    throw e;
  }
};

export const fetchBatchAnalysisContext = async ({
  symbols = [],
  analysisType = 'earnings',
  refresh = false,
  maxSymbols = 12,
} = {}) => {
  return apiPost('/advisor/analysis/batch-context', {
    symbols,
    analysis_type: analysisType,
    refresh,
    max_symbols: maxSymbols,
  });
};

export const triggerAnalysis = async (symbol, analysisType = 'earnings') => {
  return apiPost(`/advisor/analyze/${symbol}?analysis_type=${analysisType}`, {});
};

export const compareStocks = async (symbols) => {
  return apiPost('/advisor/compare', { symbols });
};

export const fetchAlerts = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.source) params.set('source', filters.source);
  if (filters.severity) params.set('severity', filters.severity);
  if (filters.symbol) params.set('symbol', filters.symbol);
  if (filters.limit) params.set('limit', filters.limit);
  const qs = params.toString();
  const data = await apiGet(`/advisor/alerts${qs ? '?' + qs : ''}`, { cache: 'no-store' });
  return data?.data ?? [];
};

export const fetchSpecialAlerts = async ({
  limit = 1000,
  symbol = '',
  currentDayOnly = true,
  includeHistory = false,
} = {}) => {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('current_day_only', currentDayOnly ? 'true' : 'false');
  params.set('include_history', includeHistory ? 'true' : 'false');
  if (symbol && String(symbol).trim()) params.set('symbol', String(symbol).trim());
  const data = await apiGet(`/advisor/alerts/special?${params.toString()}`, { cache: 'no-store' });
  return data?.data ?? [];
};

export const backfillLevelDivergenceAlerts = async ({
  days = 180,
  limitSymbols = 300,
} = {}) => {
  const params = new URLSearchParams();
  params.set('days', String(days));
  params.set('limit_symbols', String(limitSymbols));
  return apiPost(`/advisor/alerts/backfill-level-divergence?${params.toString()}`, {});
};

/** Sync weekly level-cross alerts from the latest daily bar (EOD path; fresh row timestamps). */
export const syncLatestEodWeeklyCrossAlerts = async ({
  limitSymbols = 3000,
  maxStaleDays = 14,
} = {}) => {
  const params = new URLSearchParams();
  params.set('limit_symbols', String(limitSymbols));
  params.set('max_stale_days', String(maxStaleDays));
  return apiPost(`/advisor/alerts/sync-latest-eod-weekly-cross?${params.toString()}`, {}, { cache: 'no-store' });
};

export const triggerLiveSignalScanNow = async () => {
  return apiGet('/advisor/signals/live-scan-now', { cache: 'no-store' });
};

export const markAlertRead = async (alertId) => {
  return apiRequest(`/advisor/alerts/${alertId}/read`, { method: 'PUT' });
};

export const fetchPortfolioHealth = async (symbols) => {
  const data = await apiGet(`/advisor/portfolio-health?symbols=${symbols.join(',')}`);
  return data?.result ?? null;
};

export const refreshAdvisor = async () => {
  return apiGet('/advisor/refresh');
};
