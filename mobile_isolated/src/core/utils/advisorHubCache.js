import {advisorService} from '@core/api/services/advisorService';
import {signalsService} from '@core/api/services/signalsService';
import {API_TIMEOUT_MS} from '@core/config/apiTimeouts';
import {extractApiRows} from '@core/utils/apiPayload';
import {buildChartAgentBlocks} from '@core/utils/chartFundamentalAgent';
import {CHART_FUNDAMENTAL_BLOCKS} from '@core/utils/chartFundamentalTables';
import {ADVISOR_WEB_LIMITS, ADVISOR_WEB_PARAMS} from '@core/utils/advisorWebParity';
import {dedupeSignalsBySymbol} from '@core/utils/advisorSignalsFilter';
import {safeFetch} from '@core/utils/safeFetch';

const ADVISOR_FETCH = {timeoutMs: API_TIMEOUT_MS.advisor, retries: 1};

export function normalizeAdvisorSignalsPayload(data) {
  if (!data) return null;
  if (Array.isArray(data)) {
    return {sigRows: dedupeSignalsBySymbol(data), monthlyRows: [], customRows: [], mondayRows: []};
  }
  if (typeof data !== 'object') return null;
  return {
    sigRows: Array.isArray(data.sigRows) ? dedupeSignalsBySymbol(data.sigRows) : [],
    monthlyRows: Array.isArray(data.monthlyRows) ? dedupeSignalsBySymbol(data.monthlyRows) : [],
    customRows: Array.isArray(data.customRows) ? dedupeSignalsBySymbol(data.customRows) : [],
    mondayRows: Array.isArray(data.mondayRows) ? dedupeSignalsBySymbol(data.mondayRows) : [],
  };
}

export function hasUsableAdvisorSignalsPayload(data) {
  const payload = normalizeAdvisorSignalsPayload(data);
  if (!payload) return false;
  return (
    payload.sigRows.length
    + payload.monthlyRows.length
    + payload.customRows.length
    + payload.mondayRows.length
    > 0
  );
}

/** Accept wrapped `{ trendGrid }`, API `{ data }`, or raw `{ daily, weekly, monthly }` caches. */
export function extractTrendGrid(data) {
  if (!data || typeof data !== 'object') return null;
  const candidates = [data.trendGrid, data.data, data];
  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object' && (candidate.daily || candidate.weekly || candidate.monthly)) {
      return candidate;
    }
  }
  return null;
}

export function hasUsableAdvisorTrendPayload(data) {
  return Boolean(extractTrendGrid(data));
}

/** Ensure daily / weekly / monthly chart sections always exist for rendering. */
export function mergeChartDisplayBlocks(blocks) {
  const byId = new Map((blocks || []).map(block => [block.id, block]));
  return CHART_FUNDAMENTAL_BLOCKS.map(meta => {
    const existing = byId.get(meta.id);
    return (
      existing || {
        ...meta,
        rows: [],
        matchCount: 0,
        scanned: 0,
      }
    );
  });
}

/** Accept wrapped `{ chartBlocks }` or raw chart-fundamental-agent API payloads. */
export function extractChartBlocks(data) {
  if (!data || typeof data !== 'object') return [];
  if (Array.isArray(data.chartBlocks) && data.chartBlocks.length > 0) {
    return mergeChartDisplayBlocks(data.chartBlocks);
  }
  if (Array.isArray(data.data) || Array.isArray(data.weekly_data) || Array.isArray(data.monthly_data)) {
    return buildChartAgentBlocks(data);
  }
  return [];
}

export function hasUsableAdvisorChartPayload(data) {
  return extractChartBlocks(data).some(block => (block?.rows?.length || 0) > 0);
}

export async function fetchAdvisorSignalsPayload({forceRefresh = false} = {}) {
  const [latestRes, monthlyRes, customRes, mondayRes] = await Promise.all([
    safeFetch(() => signalsService.fetchLatestSignals({limit: ADVISOR_WEB_LIMITS.latestSignals}), {
      label: 'Signals',
      ...ADVISOR_FETCH,
    }),
    safeFetch(() => advisorService.fetchMonthlyMacdSetup(ADVISOR_WEB_LIMITS.monthlyMacd), {
      label: 'Monthly MACD',
      ...ADVISOR_FETCH,
    }).catch(() => null),
    safeFetch(
      () =>
        advisorService.fetchCustomRsMacdSetup({
          limit: ADVISOR_WEB_LIMITS.customRs,
          setup_mode: ADVISOR_WEB_PARAMS.customSetupMode,
          refresh: forceRefresh,
        }),
      {label: 'Custom RS', ...ADVISOR_FETCH},
    ).catch(() => null),
    safeFetch(
      () =>
        advisorService.fetchMondayPrevWeekHighCross({
          limit: ADVISOR_WEB_LIMITS.mondayPwh,
          refresh: forceRefresh,
        }),
      {label: 'Monday PWH', ...ADVISOR_FETCH},
    ).catch(() => null),
  ]);

  return {
    sigRows: dedupeSignalsBySymbol(Array.isArray(latestRes) ? latestRes : extractApiRows(latestRes)),
    monthlyRows: dedupeSignalsBySymbol(Array.isArray(monthlyRes) ? monthlyRes : extractApiRows(monthlyRes)),
    customRows: dedupeSignalsBySymbol(Array.isArray(customRes) ? customRes : extractApiRows(customRes)),
    mondayRows: dedupeSignalsBySymbol(Array.isArray(mondayRes) ? mondayRes : extractApiRows(mondayRes)),
  };
}

export async function fetchAdvisorTrendPayload({forceRefresh = false} = {}) {
  const res = await safeFetch(
    () =>
      advisorService.fetchBuyTierCardGrid({
        symbol_limit: ADVISOR_WEB_LIMITS.buyTierSymbolLimit,
        refresh: forceRefresh,
      }),
    {label: 'Trend reversal', ...ADVISOR_FETCH},
  );
  return {trendGrid: extractTrendGrid(res)};
}

export async function fetchAdvisorChartPayload({forceRefresh = false} = {}) {
  const res = await safeFetch(
    () =>
      advisorService.fetchChartFundamentalAgent({
        refresh: forceRefresh,
        symbol_limit: ADVISOR_WEB_LIMITS.chartSymbolLimit,
        limit: ADVISOR_WEB_LIMITS.chartRowLimit,
        scan_profile: ADVISOR_WEB_PARAMS.chartScanProfile,
        rvol_min: ADVISOR_WEB_PARAMS.chartRvolMin,
        min_gates: ADVISOR_WEB_PARAMS.chartMinGates,
        include_partial: ADVISOR_WEB_PARAMS.chartIncludePartial,
      }),
    {label: 'Chart & fundamental', ...ADVISOR_FETCH},
  );
  return {chartBlocks: extractChartBlocks(res)};
}
