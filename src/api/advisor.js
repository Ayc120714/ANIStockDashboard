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
  const data = await apiGet(`/advisor/alerts${qs ? '?' + qs : ''}`);
  return data?.data ?? [];
};

export const fetchSpecialAlerts = async ({ limit = 1000, symbol = '', currentDayOnly = true } = {}) => {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('current_day_only', currentDayOnly ? 'true' : 'false');
  if (symbol && String(symbol).trim()) params.set('symbol', String(symbol).trim());
  const data = await apiGet(`/advisor/alerts/special?${params.toString()}`);
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

export const triggerLiveSignalScanNow = async () => {
  return apiPost('/advisor/signals/live-scan-now', {});
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
