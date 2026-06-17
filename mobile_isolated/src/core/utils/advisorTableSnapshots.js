import {advisorService} from '@core/api/services/advisorService';
import {signalsService} from '@core/api/services/signalsService';
import {dashboardService} from '@core/api/services/dashboardService';
import {extractApiRows} from '@core/utils/apiPayload';
import {normalizeTrendGrid} from '@core/utils/advisorHubCache';
import {buildChartAgentBlocks} from '@core/utils/chartFundamentalAgent';
import {groupBuyTierGridSetupRows, groupTrendReversalGridRows} from '@core/utils/buyTierGrid';
import {groupLatestSignalsByTier, mapSetupRows} from '@core/utils/advisorSetupTables';
import {parseStockListResponse} from '@core/utils/stockListPayload';
import {
  ADVISOR_WEB_LIMITS,
  ADVISOR_WEB_PARAMS,
  TREND_TIMEFRAMES,
  TREND_TIERS,
} from '@core/utils/advisorWebParity';
import {INBOX_SOURCES} from '@core/utils/alertInboxUtils';

export const ADVISOR_TABLE_KEYS = {
  SIG_MONTHLY: 'sig_monthly_setup',
  SIG_CUSTOM: 'sig_custom_rs',
  SIG_MONDAY: 'sig_monday_pwh',
  CHART_DAILY: 'chart_daily',
  CHART_WEEKLY: 'chart_weekly',
  CHART_MONTHLY: 'chart_monthly',
  PRICE_MOVERS: 'price_movers',
  VOLUME_MOVERS: 'volume_movers',
};

for (const tier of TREND_TIERS) {
  ADVISOR_TABLE_KEYS[`SIG_${tier}`] = `sig_${tier.toLowerCase()}`;
  for (const tf of TREND_TIMEFRAMES) {
    ADVISOR_TABLE_KEYS[`TREND_${tier}_${tf.toUpperCase()}`] = `trend_${tier.toLowerCase()}_${tf}`;
  }
}

const TF_LABEL = {daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly'};

export const ADVISOR_TABLE_META = {
  [ADVISOR_TABLE_KEYS.SIG_MONTHLY]: {
    source: INBOX_SOURCES.SIG_MONTHLY,
    label: 'Monthly MACD',
    title: 'New in Monthly MACD setup',
    advisorTab: 'sig',
  },
  [ADVISOR_TABLE_KEYS.SIG_CUSTOM]: {
    source: INBOX_SOURCES.SIG_CUSTOM,
    label: 'Custom RS/MACD',
    title: 'New in Custom RS / MACD screen',
    advisorTab: 'sig',
  },
  [ADVISOR_TABLE_KEYS.SIG_MONDAY]: {
    source: INBOX_SOURCES.SIG_MONDAY,
    label: 'Monday PWH',
    title: 'New in Monday PWH cross',
    advisorTab: 'sig',
  },
  [ADVISOR_TABLE_KEYS.CHART_DAILY]: {
    source: INBOX_SOURCES.CHART_DAILY,
    label: 'Daily D setup',
    title: 'New in Daily (D) setup',
    advisorTab: 'chart',
  },
  [ADVISOR_TABLE_KEYS.CHART_WEEKLY]: {
    source: INBOX_SOURCES.CHART_WEEKLY,
    label: 'Weekly W setup',
    title: 'New in Weekly (W) setup',
    advisorTab: 'chart',
  },
  [ADVISOR_TABLE_KEYS.CHART_MONTHLY]: {
    source: INBOX_SOURCES.CHART_MONTHLY,
    label: 'Monthly M setup',
    title: 'New in Monthly (M) setup',
    advisorTab: 'chart',
  },
  [ADVISOR_TABLE_KEYS.PRICE_MOVERS]: {
    source: INBOX_SOURCES.PRICE_MOVERS,
    label: 'Price movers',
    title: 'New in price movers',
    screensMain: 'movers',
  },
  [ADVISOR_TABLE_KEYS.VOLUME_MOVERS]: {
    source: INBOX_SOURCES.VOLUME_MOVERS,
    label: 'Volume movers',
    title: 'New in volume movers',
    screensMain: 'volume',
  },
};

const SIG_TIER_SOURCE = {
  B1: INBOX_SOURCES.SIG_B1,
  B2: INBOX_SOURCES.SIG_B2,
  B3: INBOX_SOURCES.SIG_B3,
  S1: INBOX_SOURCES.SIG_S1,
  S2: INBOX_SOURCES.SIG_S2,
  S3: INBOX_SOURCES.SIG_S3,
};

const TREND_TIER_SOURCE = {
  B1: INBOX_SOURCES.TREND_B1,
  B2: INBOX_SOURCES.TREND_B2,
  B3: INBOX_SOURCES.TREND_B3,
  S1: INBOX_SOURCES.TREND_S1,
  S2: INBOX_SOURCES.TREND_S2,
  S3: INBOX_SOURCES.TREND_S3,
};

for (const tier of TREND_TIERS) {
  const sigKey = ADVISOR_TABLE_KEYS[`SIG_${tier}`];
  ADVISOR_TABLE_META[sigKey] = {
    source: SIG_TIER_SOURCE[tier],
    label: `${tier} · Signals`,
    title: `New in ${tier} live signals`,
    advisorTab: 'sig',
  };
  for (const tf of TREND_TIMEFRAMES) {
    const trendKey = ADVISOR_TABLE_KEYS[`TREND_${tier}_${tf.toUpperCase()}`];
    ADVISOR_TABLE_META[trendKey] = {
      source: TREND_TIER_SOURCE[tier],
      label: `${tier} · ${TF_LABEL[tf]}`,
      title: `New in ${tier} tier · ${TF_LABEL[tf]}`,
      advisorTab: 'trend',
      trendTf: tf,
    };
  }
}

/** Map inbox notification source → Advisor/Screens navigation (fallback when raw payload omits advisorTab). */
export const INBOX_SOURCE_NAV_TARGETS = Object.values(ADVISOR_TABLE_META).reduce((acc, meta) => {
  if (!meta?.source) return acc;
  acc[meta.source] = {
    advisorTab: meta.advisorTab,
    trendTf: meta.trendTf,
    screensMain: meta.screensMain,
  };
  return acc;
}, {});

function symbolsFromRows(rows) {
  return [
    ...new Set(
      (rows || [])
        .map(row => String(row?.symbol || '').trim().toUpperCase())
        .filter(Boolean),
    ),
  ].sort();
}

function asRows(res) {
  if (Array.isArray(res)) return res;
  return extractApiRows(res);
}

function asStockRows(res) {
  if (Array.isArray(res)) return res;
  return parseStockListResponse(res);
}

/** Build symbol snapshots using the same APIs/limits as web advisor tabs. */
export async function fetchAdvisorTableSnapshots() {
  const [latestRes, monthlyRes, customRes, mondayRes, trendRes, chartRes, priceRes, volumeRes] =
    await Promise.allSettled([
      signalsService.fetchLatestSignals({limit: ADVISOR_WEB_LIMITS.latestSignals}),
      advisorService.fetchMonthlyMacdSetup(ADVISOR_WEB_LIMITS.monthlyMacd),
      advisorService.fetchCustomRsMacdSetup({
        limit: ADVISOR_WEB_LIMITS.customRs,
        setup_mode: ADVISOR_WEB_PARAMS.customSetupMode,
      }),
      advisorService.fetchMondayPrevWeekHighCross({limit: ADVISOR_WEB_LIMITS.mondayPwh}),
      advisorService.fetchBuyTierCardGrid({symbol_limit: ADVISOR_WEB_LIMITS.buyTierSymbolLimit}),
      advisorService.fetchChartFundamentalAgent({
        symbol_limit: ADVISOR_WEB_LIMITS.chartSymbolLimit,
        limit: ADVISOR_WEB_LIMITS.chartRowLimit,
        scan_profile: ADVISOR_WEB_PARAMS.chartScanProfile,
        rvol_min: ADVISOR_WEB_PARAMS.chartRvolMin,
        min_gates: ADVISOR_WEB_PARAMS.chartMinGates,
        include_partial: ADVISOR_WEB_PARAMS.chartIncludePartial,
      }),
      dashboardService.fetchPriceShockers({type: 'gainers', period: 'day', limit: 50}),
      dashboardService.fetchVolumeShockers({limit: 50, period: 'day'}),
    ]);

  const latest = latestRes.status === 'fulfilled' ? asRows(latestRes.value) : [];
  const monthly = monthlyRes.status === 'fulfilled' ? asRows(monthlyRes.value) : [];
  const custom = customRes.status === 'fulfilled' ? asRows(customRes.value) : [];
  const monday = mondayRes.status === 'fulfilled' ? asRows(mondayRes.value) : [];
  const trendGrid = trendRes.status === 'fulfilled' ? normalizeTrendGrid(trendRes.value) : null;
  const chartPayload = chartRes.status === 'fulfilled' ? chartRes.value : null;
  const chartBlocks = chartPayload ? buildChartAgentBlocks(chartPayload) : [];
  const priceMovers = priceRes.status === 'fulfilled' ? asStockRows(priceRes.value) : [];
  const volumeMovers = volumeRes.status === 'fulfilled' ? asStockRows(volumeRes.value) : [];

  const sigTierGrouped = groupLatestSignalsByTier(latest, new Map());
  const chartById = Object.fromEntries(chartBlocks.map(block => [block.id, block.rows || []]));

  const snapshots = {
    [ADVISOR_TABLE_KEYS.SIG_MONTHLY]: symbolsFromRows(mapSetupRows(monthly)),
    [ADVISOR_TABLE_KEYS.SIG_CUSTOM]: symbolsFromRows(mapSetupRows(custom)),
    [ADVISOR_TABLE_KEYS.SIG_MONDAY]: symbolsFromRows(mapSetupRows(monday)),
    [ADVISOR_TABLE_KEYS.CHART_DAILY]: symbolsFromRows(chartById.daily),
    [ADVISOR_TABLE_KEYS.CHART_WEEKLY]: symbolsFromRows(chartById.weekly),
    [ADVISOR_TABLE_KEYS.CHART_MONTHLY]: symbolsFromRows(chartById.monthly),
    [ADVISOR_TABLE_KEYS.PRICE_MOVERS]: symbolsFromRows(priceMovers),
    [ADVISOR_TABLE_KEYS.VOLUME_MOVERS]: symbolsFromRows(volumeMovers),
  };

  for (const tier of TREND_TIERS) {
    snapshots[ADVISOR_TABLE_KEYS[`SIG_${tier}`]] = symbolsFromRows(sigTierGrouped[tier]);
    for (const tf of TREND_TIMEFRAMES) {
      const trendGrouped = groupTrendReversalGridRows(trendGrid, {timeframe: tf});
      snapshots[ADVISOR_TABLE_KEYS[`TREND_${tier}_${tf.toUpperCase()}`]] = symbolsFromRows(
        trendGrouped[tier],
      );
    }
  }

  return snapshots;
}

export function tableSymbolsDigest(symbols = []) {
  return (Array.isArray(symbols) ? symbols : []).join(',');
}

export function diffNewTableSymbols(prevSymbols = [], nextSymbols = []) {
  const prev = new Set(Array.isArray(prevSymbols) ? prevSymbols : String(prevSymbols || '').split(',').filter(Boolean));
  return (Array.isArray(nextSymbols) ? nextSymbols : []).filter(sym => sym && !prev.has(sym));
}
