/** API limits and params aligned with web Financial Advisor tabs. */

export const MOBILE_TIER_TABLE_PAGE_SIZE = 5;

/** Mobile Signals tab + alerts inbox — keep payloads small for fast first paint. */
export const MOBILE_SIGNALS_TAB_LIMIT = 10;
export const MOBILE_ALERTS_LIMIT = 10;

/** Reduced mobile advisor/screens limits (web uses ADVISOR_WEB_LIMITS). */
export const MOBILE_ADVISOR_LIMITS = {
  latestSignals: 25,
  monthlyMacd: 40,
  customRs: 60,
  mondayPwh: 40,
  buyTierSymbolLimit: 400,
  chartSymbolLimit: 500,
  chartRowLimit: 60,
};

export const MOBILE_SCREEN_LIST_LIMIT = 30;

export const ADVISOR_WEB_LIMITS = {
  latestSignals: 250,
  monthlyMacd: 300,
  customRs: 500,
  mondayPwh: 300,
  buyTierSymbolLimit: 400,
  chartSymbolLimit: 800,
  chartRowLimit: 300,
};

export const ADVISOR_WEB_PARAMS = {
  customSetupMode: 'or_signal',
  chartScanProfile: 'chartink_rs_daily',
  chartRvolMin: 1.2,
  chartMinGates: 4,
  chartIncludePartial: false,
};

export const TREND_TIMEFRAMES = ['daily', 'weekly', 'monthly'];
export const TREND_TIERS = ['B1', 'B2', 'B3', 'S1', 'S2', 'S3'];

/** Web ChartFundamentalAgentTab fmtPct — fractional RS values ≤5 are scaled ×100. */
export function formatAdvisorRsPct(v) {
  if (v == null || v === '' || Number.isNaN(Number(v))) return '—';
  const n = Number(v);
  const pct = Math.abs(n) <= 5 ? n * 100 : n;
  return `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%`;
}
