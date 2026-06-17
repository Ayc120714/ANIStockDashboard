import {advisorService} from '@core/api/services/advisorService';
import {signalsService} from '@core/api/services/signalsService';
import {API_TIMEOUT_MS} from '@core/config/apiTimeouts';
import {extractApiRows} from '@core/utils/apiPayload';
import {buildChartAgentBlocks} from '@core/utils/chartFundamentalAgent';
import {CHART_FUNDAMENTAL_BLOCKS} from '@core/utils/chartFundamentalTables';
import {ADVISOR_WEB_PARAMS, MOBILE_ADVISOR_LIMITS, MOBILE_SIGNALS_TAB_LIMIT} from '@core/utils/advisorWebParity';
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

function isTrendGridObject(value) {
  return Boolean(
    value
    && typeof value === 'object'
    && !Array.isArray(value)
    && (value.daily || value.weekly || value.monthly),
  );
}

/** Recursively unwrap API/cache envelopes to the raw `{ daily, weekly, monthly }` grid. */
export function normalizeTrendGrid(data, depth = 0) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || depth > 4) return null;
  if (isTrendGridObject(data)) return data;

  const nested = [data.trendGrid, data.data, data.grid, data.payload, data.result];
  for (const candidate of nested) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
    if (isTrendGridObject(candidate)) return candidate;
    const deeper = normalizeTrendGrid(candidate, depth + 1);
    if (deeper) return deeper;
  }
  return null;
}

/** Accept wrapped `{ trendGrid }`, API `{ data }`, or raw `{ daily, weekly, monthly }` caches. */
export function extractTrendGrid(data) {
  return normalizeTrendGrid(data);
}

export function countTrendGridRows(grid) {
  const root = normalizeTrendGrid(grid);
  if (!root) return 0;
  let n = 0;
  for (const tf of ['daily', 'weekly', 'monthly']) {
    const block = root[tf];
    if (!block || typeof block !== 'object') continue;
    for (const tier of ['B1', 'B2', 'B3', 'S1', 'S2', 'S3']) {
      const tierData = block[tier];
      if (Array.isArray(tierData)) {
        n += tierData.length;
        continue;
      }
      const items = tierData?.items;
      if (Array.isArray(items)) n += items.length;
    }
  }
  return n;
}

export function hasUsableAdvisorTrendPayload(data) {
  const grid = normalizeTrendGrid(data);
  return Boolean(grid && (grid.daily || grid.weekly || grid.monthly));
}

/** True when at least one tier has stock rows (any timeframe). */
export function hasTrendGridRows(data) {
  return countTrendGridRows(data) > 0;
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

export async function fetchMobileSignalsTabRows() {
  const latestRes = await safeFetch(
    () =>
      signalsService.fetchLatestSignals({
        limit: MOBILE_SIGNALS_TAB_LIMIT,
        mobile_lite: true,
      }),
    {label: 'Signals tab', ...ADVISOR_FETCH},
  );
  return dedupeSignalsBySymbol(Array.isArray(latestRes) ? latestRes : extractApiRows(latestRes));
}

export async function fetchAdvisorSignalsPayload({forceRefresh = false} = {}) {
  const [latestRes, monthlyRes, customRes, mondayRes] = await Promise.all([
    safeFetch(
      () =>
        signalsService.fetchLatestSignals({
          limit: MOBILE_ADVISOR_LIMITS.latestSignals,
          mobile_lite: true,
        }),
      {
      label: 'Signals',
      ...ADVISOR_FETCH,
    }),
    safeFetch(() => advisorService.fetchMonthlyMacdSetup(MOBILE_ADVISOR_LIMITS.monthlyMacd), {
      label: 'Monthly MACD',
      ...ADVISOR_FETCH,
    }).catch(() => null),
    safeFetch(
      () =>
        advisorService.fetchCustomRsMacdSetup({
          limit: MOBILE_ADVISOR_LIMITS.customRs,
          setup_mode: ADVISOR_WEB_PARAMS.customSetupMode,
          refresh: forceRefresh,
        }),
      {label: 'Custom RS', ...ADVISOR_FETCH},
    ).catch(() => null),
    safeFetch(
      () =>
        advisorService.fetchMondayPrevWeekHighCross({
          limit: MOBILE_ADVISOR_LIMITS.mondayPwh,
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
  const res = await advisorService.fetchBuyTierCardGrid({
    symbol_limit: MOBILE_ADVISOR_LIMITS.buyTierSymbolLimit,
    lite: true,
    refresh: forceRefresh,
    timeoutMs: API_TIMEOUT_MS.advisor,
  });
  const grid = normalizeTrendGrid(res);
  if (!grid) {
    throw new Error('Trend reversal data format was invalid.');
  }
  return grid;
}

export async function fetchAdvisorChartPayload({forceRefresh = false} = {}) {
  const res = await safeFetch(
    () =>
      advisorService.fetchChartFundamentalAgent({
        refresh: forceRefresh,
        symbol_limit: MOBILE_ADVISOR_LIMITS.chartSymbolLimit,
        limit: MOBILE_ADVISOR_LIMITS.chartRowLimit,
        scan_profile: ADVISOR_WEB_PARAMS.chartScanProfile,
        rvol_min: ADVISOR_WEB_PARAMS.chartRvolMin,
        min_gates: ADVISOR_WEB_PARAMS.chartMinGates,
        include_partial: ADVISOR_WEB_PARAMS.chartIncludePartial,
      }),
    {label: 'Chart & fundamental', ...ADVISOR_FETCH},
  );
  return {chartBlocks: extractChartBlocks(res)};
}
