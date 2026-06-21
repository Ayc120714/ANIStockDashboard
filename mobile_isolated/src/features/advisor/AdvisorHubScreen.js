import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useFocusEffect, useRoute} from '@react-navigation/native';
import {MobileChrome} from '@components/mobileChrome/MobileChrome';
import {ListPagePager} from '@components/ListPagePager';
import {OptionPicker} from '@components/OptionPicker';
import {SymbolAutocomplete} from '@components/SymbolAutocomplete';
import {TradingViewLink} from '@components/TradingViewLink';
import {SortableTableHeader} from '@components/SortableTableHeader';
import {mobilePad, mobileStyles, AYC} from '@core/theme/mobileStyles';
import {advisorService} from '@core/api/services/advisorService';
import {
  MOBILE_PAGE_CACHE_KEYS,
  LEGACY_ADVISOR_TREND_CACHE_KEYS,
  shouldForceAdvisorTrendNetwork,
  shouldRefreshAdvisorTrendCache,
} from '@core/utils/dashboardCachePolicy';
import {runScreenPayloadFetch, runScreenPayloadRefresh, shouldRefreshPageCache} from '@core/utils/screenPageLoader';
import {readPageCache, clearPageCache} from '@core/storage/pageCache';
import {
  extractChartBlocks,
  fetchAdvisorChartPayload,
  fetchAdvisorSignalsPayload,
  fetchAdvisorTrendPayload,
  hasTrendGridRows,
  hasUsableAdvisorChartPayload,
  hasUsableAdvisorSignalsPayload,
  hasUsableAdvisorTrendPayload,
  mergeChartDisplayBlocks,
  normalizeAdvisorSignalsPayload,
  normalizeTrendGrid,
} from '@core/utils/advisorHubCache';
import {extractApiRows} from '@core/utils/apiPayload';
import {
  TIER_SETUPS,
} from '@core/utils/advisorSetupTables';
import {formatChartCell} from '@core/utils/chartFundamentalTables';
import {groupTrendReversalGridRows} from '@core/utils/buyTierGrid';
import {formatINR} from '@core/utils/formatMarket';
import {navigateToSignals} from '@nav/navigationHelpers';
import {sortRows} from '@core/utils/tableSort';
import {getAdvisorSortValue} from '@core/utils/screenSortValues';
import {useTableSort} from '@hooks/useTableSort';
import {usePagedList} from '@hooks/usePagedList';
import {AI_ANALYSIS_SETUPS, getAnalysisSetupLabel} from '@core/utils/aiAnalysisSetups';
import {loadUserEnabledSymbols} from '@core/utils/userEnabledSymbols';
import {AdvisorSignalsSection} from './AdvisorSignalsSection';

import {MOBILE_TIER_TABLE_PAGE_SIZE} from '@core/utils/advisorWebParity';

const ADVISOR_PAGE_SIZE = 10;
const TREND_TIER_PAGE_SIZE = MOBILE_TIER_TABLE_PAGE_SIZE;

const TABS = [
  {id: 'sig', label: 'Signals & alerts'},
  {id: 'trend', label: 'Trend reversal'},
  {id: 'chart', label: 'Chart & fundamental'},
  {id: 'ai', label: 'AI analysis'},
  {id: 'health', label: 'Portfolio health'},
];

function formatChgPct(v) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  const n = Number(v);
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function HoldingsChipRow({
  symbols = [],
  selectedSymbol = '',
  onPick,
  multiSelect = false,
  selectedSet,
  onToggle,
}) {
  if (!symbols.length) {
    return <Text style={styles.holdingsEmpty}>No holdings or watchlist stocks yet. Add stocks in Short/Long Term watchlist or connect a broker.</Text>;
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
      {symbols.map(row => {
        const sym = row.symbol;
        const active = multiSelect ? selectedSet?.has(sym) : selectedSymbol === sym;
        return (
          <Pressable
            key={sym}
            onPress={() => (multiSelect ? onToggle(sym) : onPick(sym))}
            style={[styles.chip, active ? styles.chipOn : null]}>
            <Text style={[styles.chipText, active ? styles.chipTextOn : null]}>{sym}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function TrendTierTable({title, rows, enabled, tone, pageSize = TREND_TIER_PAGE_SIZE, timeframe = ''}) {
  const list = rows || [];
  const {page, setPage, totalPages, pagedItems, totalItems} = usePagedList(list, {
    pageSize,
    resetDeps: [title, timeframe, list.length],
  });
  return (
    <View style={styles.setupBlock}>
      <View style={[styles.setupTitleWrap, enabled && list.length ? styles.setupTitleOn : styles.setupTitleOff]}>
        <Text style={[styles.setupTitle, enabled && list.length ? styles.setupTitleTextOn : null]}>{title}</Text>
        <Text style={[styles.setupCount, enabled && list.length ? styles.setupTitleTextOn : null]}>{list.length}</Text>
      </View>
      {!list.length ? (
        <Text style={styles.tierEmpty}>No matches for this timeframe.</Text>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              <View style={styles.thRow}>
                <Text style={[styles.th, styles.trSym]}>Symbol</Text>
                <Text style={[styles.th, styles.trTv]} />
                <Text style={[styles.th, styles.trNum]}>Close</Text>
                <Text style={[styles.th, styles.trNum]}>CHG%</Text>
                <Text style={[styles.th, styles.trTier]}>Tier</Text>
              </View>
              {pagedItems.map((row, index) => (
                <View
                  key={`${title}-${row.symbol}-${index}`}
                  style={[
                    styles.tr,
                    index % 2 === 0 ? styles.trAlt : null,
                    tone === 'bull' ? styles.trBull : tone === 'bear' ? styles.trBear : null,
                    row.is_fresh ? styles.trFresh : null,
                  ]}>
                  <Text style={[styles.td, styles.trSym, styles.symBold]} numberOfLines={1}>
                    {row.symbol}
                  </Text>
                  <View style={[styles.td, styles.trTv]}>
                    <TradingViewLink symbol={row.symbol} />
                  </View>
                  <Text style={[styles.td, styles.trNum]}>{row.close != null ? formatINR(row.close) : '—'}</Text>
                  <Text style={[styles.td, styles.trNum]}>{formatChgPct(row.chg_pct)}</Text>
                  <Text style={[styles.td, styles.trTier]}>{row.buy_sell_tier || '—'}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
          <ListPagePager page={page} totalPages={totalPages} totalItems={totalItems} onPageChange={setPage} />
        </>
      )}
    </View>
  );
}

function ChartFundamentalTable({block, pageSize = ADVISOR_PAGE_SIZE}) {
  const hasPrev = Boolean(block.prevHeader);
  const {page, setPage, totalPages, pagedItems, totalItems} = usePagedList(block.rows || [], {
    pageSize,
    resetDeps: [block.id, block.rows?.length],
  });
  return (
    <View style={styles.setupBlock}>
      <View style={[styles.setupTitleWrap, block.rows.length ? styles.setupTitleOn : styles.setupTitleOff]}>
        <Text style={[styles.setupTitle, block.rows.length ? styles.setupTitleTextOn : null]}>{block.title}</Text>
        <Text style={[styles.setupCount, block.rows.length ? styles.setupTitleTextOn : null]}>{block.matchCount}</Text>
      </View>
      <Text style={styles.chartHint}>
        {block.matchCount} matches · scanned {block.scanned} symbols
      </Text>
      {block.rows.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <View style={styles.thRow}>
              <Text style={[styles.th, styles.cfSym]}>Symbol</Text>
              <Text style={[styles.th, styles.cfTv]} />
              <Text style={[styles.th, styles.cfSector]}>Sector</Text>
              <Text style={[styles.th, styles.cfNum]}>{block.closeHeader}</Text>
              {hasPrev ? <Text style={[styles.th, styles.cfNum]}>{block.prevHeader}</Text> : null}
              <Text style={[styles.th, styles.cfRating]}>Rating</Text>
              <Text style={[styles.th, styles.cfHorizon]}>Horizon</Text>
            </View>
            {pagedItems.map((row, index) => (
              <View
                key={`${block.id}-${row.symbol}-${index}`}
                style={[
                  styles.tr,
                  index % 2 === 0 ? styles.trAlt : null,
                  row.passed_all ? styles.trPass : null,
                ]}>
                <Text style={[styles.td, styles.cfSym, styles.symBold]} numberOfLines={1}>
                  {row.symbol}
                </Text>
                <View style={[styles.td, styles.cfTv]}>
                  <TradingViewLink symbol={row.symbol} />
                </View>
                <Text style={[styles.td, styles.cfSector]} numberOfLines={1}>
                  {row.sector}
                </Text>
                <Text style={[styles.td, styles.cfNum]}>{formatChartCell(row, 'close')}</Text>
                {hasPrev ? <Text style={[styles.td, styles.cfNum]}>{formatChartCell(row, 'prevClose')}</Text> : null}
                <Text style={[styles.td, styles.cfRating]} numberOfLines={1}>
                  {row.rating}
                </Text>
                <Text style={[styles.td, styles.cfHorizon]} numberOfLines={1}>
                  {row.horizon}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>
      ) : (
        <Text style={styles.empty}>No symbols match this setup.</Text>
      )}
      {block.rows.length ? (
        <ListPagePager
          page={page}
          totalPages={totalPages}
          totalItems={totalItems}
          onPageChange={setPage}
        />
      ) : null}
    </View>
  );
}

export function AdvisorHubScreen({navigation}) {
  const route = useRoute();
  const [tab, setTab] = useState('sig');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [trendErr, setTrendErr] = useState('');
  const [sigRows, setSigRows] = useState([]);
  const [monthlyRows, setMonthlyRows] = useState([]);
  const [customRows, setCustomRows] = useState([]);
  const [mondayRows, setMondayRows] = useState([]);
  const [trendGrid, setTrendGrid] = useState(null);
  const [trendTf, setTrendTf] = useState('weekly');
  const [aiSym, setAiSym] = useState('');
  const [aiType, setAiType] = useState('earnings');
  const [aiHist, setAiHist] = useState([]);
  const [aiLatest, setAiLatest] = useState(null);
  const [showAiSetupPicker, setShowAiSetupPicker] = useState(false);
  const [enabledSymbols, setEnabledSymbols] = useState([]);
  const [healthSelected, setHealthSelected] = useState(() => new Set());
  const [healthResult, setHealthResult] = useState(null);
  const [chartBlocks, setChartBlocks] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [trendLoading, setTrendLoading] = useState(false);
  const [cacheHydrated, setCacheHydrated] = useState(false);
  const signalsHasDataRef = useRef(false);
  const chartHasDataRef = useRef(false);
  const trendHasDataRef = useRef(false);
  const focusLoadReadyRef = useRef(false);
  const {sortConfig, onSort, resetSort} = useTableSort();

  const applySignalsPayload = useCallback(payload => {
    setSigRows(payload?.sigRows || []);
    setMonthlyRows(payload?.monthlyRows || []);
    setCustomRows(payload?.customRows || []);
    setMondayRows(payload?.mondayRows || []);
  }, []);

  const applyTrendPayload = useCallback(payload => {
    const grid = normalizeTrendGrid(payload) || payload;
    setTrendGrid(grid);
    setTrendErr('');
  }, []);

  const applyChartPayload = useCallback(payload => {
    setChartBlocks(extractChartBlocks(payload));
    setErr('');
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.all(LEGACY_ADVISOR_TREND_CACHE_KEYS.map(key => clearPageCache(key)));
      const [sigCache, trendCache, chartCache] = await Promise.all([
        readPageCache(MOBILE_PAGE_CACHE_KEYS.advisorHubSignals),
        readPageCache(MOBILE_PAGE_CACHE_KEYS.advisorHubTrend),
        readPageCache(MOBILE_PAGE_CACHE_KEYS.advisorHubChart),
      ]);
      if (cancelled) return;

      const signals = normalizeAdvisorSignalsPayload(sigCache?.data);
      if (hasUsableAdvisorSignalsPayload(signals)) {
        applySignalsPayload(signals);
      }
      if (hasUsableAdvisorTrendPayload(trendCache?.data)) {
        applyTrendPayload(trendCache.data);
      } else if (trendCache?.data != null) {
        await clearPageCache(MOBILE_PAGE_CACHE_KEYS.advisorHubTrend);
      }
      const hydratedChart = extractChartBlocks(chartCache?.data);
      if (hasUsableAdvisorChartPayload(chartCache?.data)) {
        setChartBlocks(hydratedChart);
      }
      setCacheHydrated(true);
      focusLoadReadyRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [applySignalsPayload, applyTrendPayload]);

  useEffect(() => {
    resetSort();
  }, [tab, resetSort]);

  const selectTab = useCallback(
    nextTab => {
      if (nextTab === tab) return;
      setErr('');
      if (nextTab !== 'trend') setTrendErr('');
      setTab(nextTab);
      resetSort();
    },
    [resetSort, tab],
  );

  useEffect(() => {
    const next = route?.params?.advisorTab;
    if (next && TABS.some(t => t.id === next)) {
      selectTab(next);
    }
  }, [route?.params?.advisorTab, selectTab]);

  useFocusEffect(
    useCallback(() => {
      const next = route?.params?.advisorTab;
      if (next && TABS.some(t => t.id === next)) {
        setTab(next);
      }
      const tf = route?.params?.trendTf;
      if (tf && ['daily', 'weekly', 'monthly'].includes(tf)) {
        setTrendTf(tf);
      }
    }, [route?.params?.advisorTab, route?.params?.trendTf]),
  );

  useEffect(() => {
    const tf = route?.params?.trendTf;
    if (tf && ['daily', 'weekly', 'monthly'].includes(tf)) {
      setTrendTf(tf);
    }
  }, [route?.params?.trendTf]);

  const refreshEnabledSymbols = useCallback(async () => {
    const rows = await loadUserEnabledSymbols();
    setEnabledSymbols(rows);
    setHealthSelected(new Set(rows.map(r => r.symbol)));
  }, []);

  useEffect(() => {
    if (tab === 'ai' || tab === 'health') {
      refreshEnabledSymbols().catch(() => {});
    }
  }, [refreshEnabledSymbols, tab]);

  const toggleHealthSymbol = useCallback(sym => {
    const key = String(sym || '').trim().toUpperCase();
    if (!key) return;
    setHealthSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const healthRows = useMemo(() => {
    const result = healthResult?.result;
    if (!result || typeof result !== 'object') return [];
    const table = Array.isArray(result.sentiment_table) ? result.sentiment_table : [];
    return table.map(row => ({
      stock: String(row?.stock || '—').trim(),
      sentiment: String(row?.sentiment || '—').trim(),
      expectation: String(row?.analyst_expectation || '').trim(),
    }));
  }, [healthResult]);

  const trendGrouped = useMemo(
    () => groupTrendReversalGridRows(trendGrid, {timeframe: trendTf}),
    [trendGrid, trendTf],
  );

  const trendVisibleRows = useMemo(
    () => TIER_SETUPS.reduce((n, setup) => n + (trendGrouped[setup.id]?.length || 0), 0),
    [trendGrouped],
  );

  const trendHasData = hasTrendGridRows(trendGrid);
  const chartDisplayBlocks = useMemo(() => mergeChartDisplayBlocks(chartBlocks), [chartBlocks]);
  const chartHasData = chartDisplayBlocks.some(b => (b?.rows?.length || 0) > 0);

  const sortedAiHist = useMemo(
    () => sortRows(aiHist, sortConfig, getAdvisorSortValue),
    [aiHist, sortConfig],
  );

  const aiPaged = usePagedList(sortedAiHist, {
    pageSize: ADVISOR_PAGE_SIZE,
    resetDeps: [aiSym, sortConfig?.key, sortConfig?.ascending],
  });

  const signalsHasData = hasUsableAdvisorSignalsPayload({
    sigRows,
    monthlyRows,
    customRows,
    mondayRows,
  });

  signalsHasDataRef.current = signalsHasData;
  chartHasDataRef.current = chartHasData;
  trendHasDataRef.current = trendHasData;

  const loadSignals = useCallback(async ({silent = false, forceRefresh = false} = {}) => {
    if (forceRefresh) setRefreshing(true);
    await runScreenPayloadFetch({
      cacheKey: MOBILE_PAGE_CACHE_KEYS.advisorHubSignals,
      fetcher: () => fetchAdvisorSignalsPayload({forceRefresh}),
      applyPayload: applySignalsPayload,
      setLoading: silent && !forceRefresh ? () => {} : setLoading,
      setError: msg => setErr(msg || ''),
      forceNetwork: forceRefresh,
      hasUsable: hasUsableAdvisorSignalsPayload,
      silent: silent && !forceRefresh,
    });
    setRefreshing(false);
  }, [applySignalsPayload]);

  const loadChart = useCallback(async ({silent = false, forceRefresh = false} = {}) => {
    if (forceRefresh) {
      await runScreenPayloadRefresh({
        cacheKey: MOBILE_PAGE_CACHE_KEYS.advisorHubChart,
        fetcher: () => fetchAdvisorChartPayload({forceRefresh: true}),
        applyPayload: applyChartPayload,
        setRefreshing,
        setLoading: silent && chartHasDataRef.current ? () => {} : setLoading,
        setError: msg => setErr(msg || ''),
        hasUsable: hasUsableAdvisorChartPayload,
      });
      return;
    }
    await runScreenPayloadFetch({
      cacheKey: MOBILE_PAGE_CACHE_KEYS.advisorHubChart,
      fetcher: () => fetchAdvisorChartPayload({forceRefresh: false}),
      applyPayload: applyChartPayload,
      setLoading: silent && !forceRefresh ? () => {} : setLoading,
      setError: msg => setErr(msg || ''),
      forceNetwork: false,
      hasUsable: hasUsableAdvisorChartPayload,
      silent: silent && chartHasDataRef.current,
    });
  }, [applyChartPayload]);

  const loadTrend = useCallback(async ({silent = false, forceRefresh = false} = {}) => {
    if (forceRefresh) {
      await runScreenPayloadRefresh({
        cacheKey: MOBILE_PAGE_CACHE_KEYS.advisorHubTrend,
        fetcher: () => fetchAdvisorTrendPayload({forceRefresh: true}),
        applyPayload: applyTrendPayload,
        setRefreshing,
        setLoading: v => {
          if (!trendHasDataRef.current) setTrendLoading(v);
        },
        setError: msg => setTrendErr(msg || ''),
        hasUsable: hasUsableAdvisorTrendPayload,
      });
      return;
    }
    await runScreenPayloadFetch({
      cacheKey: MOBILE_PAGE_CACHE_KEYS.advisorHubTrend,
      fetcher: () => fetchAdvisorTrendPayload({forceRefresh: false}),
      applyPayload: applyTrendPayload,
      setLoading: v => {
        if (!silent && !trendHasDataRef.current) setTrendLoading(v);
      },
      setError: msg => setTrendErr(msg || ''),
      forceNetwork: false,
      hasUsable: hasUsableAdvisorTrendPayload,
      silent: silent && trendHasDataRef.current,
    });
    if (!trendHasDataRef.current) setTrendLoading(false);
  }, [applyTrendPayload]);

  useEffect(() => {
    if (!cacheHydrated) return;
    if (tab === 'sig') {
      loadSignals({silent: signalsHasDataRef.current});
    } else if (tab === 'chart') {
      loadChart({silent: chartHasDataRef.current});
    } else if (tab === 'trend') {
      loadTrend({silent: trendHasDataRef.current, forceRefresh: false});
    }
  }, [cacheHydrated, loadChart, loadSignals, loadTrend, tab]);

  useFocusEffect(
    useCallback(() => {
      if (!focusLoadReadyRef.current) return undefined;
      (async () => {
        if (tab === 'sig') {
          const stale = await shouldRefreshPageCache(MOBILE_PAGE_CACHE_KEYS.advisorHubSignals);
          if (stale || !signalsHasData) {
            await loadSignals({silent: signalsHasData});
          }
        } else if (tab === 'trend') {
          const stale = await shouldRefreshPageCache(MOBILE_PAGE_CACHE_KEYS.advisorHubTrend);
          if (shouldRefreshAdvisorTrendCache({stale, trendHasData})) {
            await loadTrend({
              silent: trendHasData,
              forceRefresh: shouldForceAdvisorTrendNetwork({stale, trendHasData}),
            });
          }
        } else if (tab === 'chart') {
          const stale = await shouldRefreshPageCache(MOBILE_PAGE_CACHE_KEYS.advisorHubChart);
          if (stale || !chartHasData) {
            await loadChart({silent: chartHasData});
          }
        }
      })();
      return undefined;
    }, [chartHasData, loadChart, loadSignals, loadTrend, signalsHasData, tab, trendHasData]),
  );

  const loadAi = useCallback(async () => {
    if (!aiSym.trim()) {
      setErr('Select a symbol from your holdings');
      return;
    }
    setErr('');
    setLoading(true);
    try {
      const res = await advisorService.fetchAnalysis(aiSym.trim().toUpperCase(), 20);
      const rows = extractApiRows(res, ['data']);
      setAiHist(rows);
      const match = rows.find(r => String(r.analysis_type) === aiType);
      setAiLatest(match || rows[0] || null);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [aiSym, aiType]);

  const runAi = useCallback(async () => {
    if (!aiSym.trim()) {
      setErr('Select a symbol from your holdings');
      return;
    }
    setLoading(true);
    setErr('');
    try {
      const res = await advisorService.triggerAnalyze(aiSym.trim().toUpperCase(), aiType);
      const payload = res?.result || res;
      setAiLatest(
        payload
          ? {
              ...payload,
              analysis_type: res?.analysis_type || aiType,
              rating: payload.rating,
              confidence: payload.confidence,
              summary: payload.summary,
            }
          : null,
      );
      await loadAi();
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [aiSym, aiType, loadAi]);

  const runHealth = useCallback(async () => {
    const syms = [...healthSelected];
    if (!syms.length) {
      setErr('Select at least one holding stock');
      return;
    }
    setLoading(true);
    setErr('');
    try {
      const res = await advisorService.fetchPortfolioHealth(syms.join(','));
      setHealthResult(res);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [healthSelected]);

  const head = (
    <View style={{gap: 8}}>
      <Text style={mobileStyles.pageTitle}>Financial advisor</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {TABS.map(t => (
          <Pressable key={t.id} onPress={() => selectTab(t.id)} style={[styles.chip, tab === t.id ? styles.chipOn : null]}>
            <Text style={[styles.chipText, tab === t.id ? styles.chipTextOn : null]}>{t.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {tab === 'trend' && trendErr ? (
        <View style={styles.errRow}>
          <Text style={styles.err}>{trendErr}</Text>
          <Pressable onPress={() => loadTrend({forceRefresh: true})} style={styles.retryBtn}>
            <Text style={styles.retryTxt}>Retry</Text>
          </Pressable>
        </View>
      ) : err ? (
        <View style={styles.errRow}>
          <Text style={styles.err}>{err}</Text>
          {tab === 'sig' ? (
            <Pressable onPress={() => loadSignals()} style={styles.retryBtn}>
              <Text style={styles.retryTxt}>Retry</Text>
            </Pressable>
          ) : tab === 'chart' ? (
            <Pressable onPress={() => loadChart()} style={styles.retryBtn}>
              <Text style={styles.retryTxt}>Retry</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {((tab === 'sig' && loading && !signalsHasData) ||
        (tab === 'trend' && trendLoading && !trendHasData) ||
        (tab === 'chart' && loading && !chartHasData)) ? (
        <ActivityIndicator color={AYC.accent} />
      ) : null}
    </View>
  );

  if (tab === 'sig') {
    return (
      <MobileChrome navigation={navigation}>
        <ScrollView
          style={{flex: 1}}
          contentContainerStyle={styles.pad}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadSignals({silent: true, forceRefresh: true})}
            />
          }>
          {head}
          <AdvisorSignalsSection
            sigRows={sigRows}
            monthlyRows={monthlyRows}
            customRows={customRows}
            mondayRows={mondayRows}
            loading={loading}
            cacheHydrated={cacheHydrated}
          />
        </ScrollView>
      </MobileChrome>
    );
  }

  if (tab === 'trend') {
    const TREND_TFS = [
      {id: 'daily', label: 'Daily'},
      {id: 'weekly', label: 'Weekly'},
      {id: 'monthly', label: 'Monthly'},
    ];
    return (
      <MobileChrome navigation={navigation}>
        <ScrollView
          style={{flex: 1}}
          contentContainerStyle={styles.pad}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadTrend({forceRefresh: true})} />
          }>
          {head}
          <Text style={mobileStyles.subtitle}>
            Trend reversal · B1–S3 buy / sell tiers · {trendVisibleRows} matches · {trendTf}
          </Text>
          {trendLoading && !trendHasData ? (
            <Text style={styles.trendLoadingHint}>
              Loading trend reversal data… This can take up to 2 minutes on first load.
            </Text>
          ) : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {TREND_TFS.map(tf => (
              <Pressable
                key={tf.id}
                onPress={() => setTrendTf(tf.id)}
                style={[styles.chip, trendTf === tf.id ? styles.chipOn : null]}>
                <Text style={[styles.chipText, trendTf === tf.id ? styles.chipTextOn : null]}>{tf.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {TIER_SETUPS.map(setup => (
            <TrendTierTable
              key={`${setup.id}-${trendTf}`}
              title={setup.label}
              rows={trendGrouped[setup.id] || []}
              enabled={(trendGrouped[setup.id] || []).length > 0}
              tone={setup.tone}
              pageSize={TREND_TIER_PAGE_SIZE}
              timeframe={trendTf}
            />
          ))}

          {cacheHydrated && !trendLoading && !trendHasData ? (
            <Text style={styles.empty}>No trend reversal matches for this timeframe. Pull down to refresh.</Text>
          ) : null}
        </ScrollView>
      </MobileChrome>
    );
  }

  if (tab === 'chart') {
    return (
      <MobileChrome navigation={navigation}>
        <ScrollView
          style={{flex: 1}}
          contentContainerStyle={styles.pad}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadChart({silent: true, forceRefresh: true})}
            />
          }>
          {head}
          <Text style={mobileStyles.subtitle}>Daily / weekly / monthly custom screener</Text>
          {cacheHydrated
            ? chartDisplayBlocks.map(block => <ChartFundamentalTable key={block.id} block={block} />)
            : null}
          {cacheHydrated && !loading && !chartHasData ? (
            <Text style={styles.empty}>No RS setup rows loaded. Pull down to refresh.</Text>
          ) : null}
        </ScrollView>
      </MobileChrome>
    );
  }

  if (tab === 'ai') {
    return (
      <MobileChrome navigation={navigation}>
        <ScrollView style={{flex: 1}} contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
          {head}
          <Text style={mobileStyles.subtitle}>AI company analysis · pick setup and symbol</Text>

          <Text style={styles.fieldLabel}>Analysis setup</Text>
          <Pressable style={styles.selectBtn} onPress={() => setShowAiSetupPicker(true)}>
            <Text style={styles.selectBtnText}>{getAnalysisSetupLabel(aiType)}</Text>
            <Text style={styles.selectBtnCaret}>▾</Text>
          </Pressable>

          <Text style={styles.fieldLabel}>Your holdings & watchlist ({enabledSymbols.length})</Text>
          <HoldingsChipRow
            symbols={enabledSymbols}
            selectedSymbol={aiSym}
            onPick={sym => setAiSym(sym)}
          />

          <Text style={styles.fieldLabel}>Symbol</Text>
          <SymbolAutocomplete
            value={aiSym}
            onChange={setAiSym}
            options={enabledSymbols}
            placeholder="Search your enabled stocks…"
          />

          <View style={styles.rowBtn}>
            <Pressable style={styles.btn} onPress={loadAi} disabled={loading}>
              <Text style={styles.btnTxt}>Load history</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnGhost]} onPress={runAi} disabled={loading}>
              <Text style={[styles.btnTxt, {color: AYC.accent}]}>{loading ? 'Running…' : 'Run analysis'}</Text>
            </Pressable>
          </View>

          {aiLatest ? (
            <View style={styles.aiBox}>
              <Text style={styles.aiTypeTag}>{getAnalysisSetupLabel(aiLatest.analysis_type || aiType)}</Text>
              <Text style={styles.aiRating}>{String(aiLatest.rating || '—').toUpperCase()}</Text>
              <Text style={styles.aiConf}>Confidence: {aiLatest.confidence ?? '—'}%</Text>
              <Text style={styles.aiSum}>{aiLatest.summary || '—'}</Text>
            </View>
          ) : null}

          <Text style={styles.blockTitle}>Analysis history</Text>
          <View style={styles.thRow}>
            <SortableTableHeader label="Type" sortKey="analysis_type" sortConfig={sortConfig} onSort={onSort} style={{flex: 0.8}} textStyle={styles.th} />
            <SortableTableHeader label="Rating" sortKey="rating" sortConfig={sortConfig} onSort={onSort} style={{flex: 0.6}} textStyle={styles.th} />
            <SortableTableHeader label="Conf" sortKey="confidence" sortConfig={sortConfig} onSort={onSort} style={{width: 44}} textStyle={styles.th} />
            <SortableTableHeader label="Date" sortKey="date" sortConfig={sortConfig} onSort={onSort} style={{flex: 1}} textStyle={styles.th} />
          </View>
          {aiPaged.pagedItems.map((r, i) => (
            <View key={r.id || i} style={[styles.tr, i % 2 === 1 ? styles.trAlt : null]}>
              <Text style={[styles.td, {flex: 0.8}]} numberOfLines={1}>
                {getAnalysisSetupLabel(r.analysis_type)}
              </Text>
              <Text style={[styles.td, {flex: 0.6}]}>{r.rating || '—'}</Text>
              <Text style={[styles.td, {width: 44}]}>{r.confidence ?? '—'}</Text>
              <Text style={[styles.td, {flex: 1, fontSize: AYC.type.cardLabel}]} numberOfLines={2}>
                {String(r.created_at || '').slice(0, 10)}
              </Text>
            </View>
          ))}
          <ListPagePager
            page={aiPaged.page}
            totalPages={aiPaged.totalPages}
            totalItems={aiPaged.totalItems}
            onPageChange={aiPaged.setPage}
          />
        </ScrollView>
        <OptionPicker
          visible={showAiSetupPicker}
          title="Analysis setup"
          subtitle="Choose the AI analysis type to run"
          options={AI_ANALYSIS_SETUPS}
          selectedId={aiType}
          onSelect={setAiType}
          onClose={() => setShowAiSetupPicker(false)}
        />
      </MobileChrome>
    );
  }

  if (tab === 'health') {
    return (
      <MobileChrome navigation={navigation}>
        <ScrollView style={{flex: 1}} contentContainerStyle={styles.pad}>
          {head}
          <Text style={mobileStyles.subtitle}>Portfolio health · select your enabled holdings</Text>
          <View style={styles.healthActions}>
            <Pressable
              style={styles.chipSm}
              onPress={() => setHealthSelected(new Set(enabledSymbols.map(r => r.symbol)))}>
              <Text style={styles.mini}>Select all</Text>
            </Pressable>
            <Pressable style={styles.chipSm} onPress={() => setHealthSelected(new Set())}>
              <Text style={styles.mini}>Clear</Text>
            </Pressable>
            <Text style={styles.healthCount}>{healthSelected.size} selected</Text>
          </View>
          <HoldingsChipRow
            symbols={enabledSymbols}
            multiSelect
            selectedSet={healthSelected}
            onToggle={toggleHealthSymbol}
          />
          <Pressable style={styles.btn} onPress={runHealth} disabled={loading || healthSelected.size === 0}>
            <Text style={styles.btnTxt}>{loading ? 'Checking…' : 'Check portfolio health'}</Text>
          </Pressable>
          {healthRows.length ? (
            <View style={styles.healthTable}>
              <View style={styles.thRow}>
                <Text style={[styles.th, {flex: 0.8}]}>Stock</Text>
                <Text style={[styles.th, {flex: 0.7}]}>Sentiment</Text>
                <Text style={[styles.th, {flex: 1.2}]}>Analysis</Text>
              </View>
              {healthRows.map(row => (
                <View key={row.stock} style={styles.tr}>
                  <Text style={[styles.td, {flex: 0.8, fontWeight: '800'}]}>{row.stock}</Text>
                  <Text style={[styles.td, {flex: 0.7}]}>{row.sentiment}</Text>
                  <Text style={[styles.td, {flex: 1.2}]} numberOfLines={3}>
                    {row.expectation || '—'}
                  </Text>
                </View>
              ))}
            </View>
          ) : healthResult?.result ? (
            <View style={styles.healthBox}>
              <Text style={styles.healthTxt}>
                {typeof healthResult.result === 'string'
                  ? healthResult.result
                  : healthResult.result.summary || JSON.stringify(healthResult.result, null, 2)}
              </Text>
            </View>
          ) : null}
          <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => navigation.navigate('Portfolio')}>
            <Text style={[styles.btnTxt, {color: AYC.accent}]}>Portfolio manager</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => navigateToSignals(navigation)}>
            <Text style={[styles.btnTxt, {color: AYC.accent}]}>Live signals</Text>
          </Pressable>
        </ScrollView>
      </MobileChrome>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  pad: mobilePad,
  chipRow: {flexDirection: 'row', gap: 8, paddingVertical: 4},
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: AYC.accent,
    backgroundColor: AYC.card,
  },
  chipOn: {backgroundColor: AYC.appBar, borderColor: AYC.appBar},
  chipDim: {opacity: 0.45},
  chipText: {fontSize: AYC.type.caption, fontWeight: '800', color: AYC.accent},
  chipTextOn: {color: '#fff'},
  chipSm: {paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: AYC.accent},
  mini: {fontSize: AYC.type.caption, fontWeight: '800', color: AYC.accent},
  err: {color: AYC.negative, fontSize: AYC.type.caption, flex: 1},
  errRow: {flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap'},
  retryBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: AYC.negative,
  },
  retryTxt: {color: AYC.negative, fontWeight: '800', fontSize: AYC.type.caption},
  empty: {paddingVertical: 16, color: AYC.textMuted, textAlign: 'center', fontSize: AYC.type.body},
  trendLoadingHint: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    color: AYC.textMuted,
    fontSize: AYC.type.cardLabel,
    textAlign: 'center',
  },
  tierEmpty: {paddingVertical: 10, paddingHorizontal: 12, color: AYC.textMuted, fontSize: AYC.type.cardLabel},
  chartHint: {fontSize: AYC.type.caption, color: AYC.textMuted, paddingHorizontal: 4, marginBottom: 4},
  setupBlock: {marginTop: 12},
  setupTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 6,
  },
  setupTitleOn: {backgroundColor: AYC.appBar},
  setupTitleOff: {backgroundColor: '#e5e7eb'},
  setupTitle: {fontSize: AYC.type.body, fontWeight: '800', color: AYC.text, flex: 1},
  setupTitleTextOn: {color: '#fff'},
  setupCount: {fontSize: AYC.type.caption, fontWeight: '800', color: AYC.textMuted, marginLeft: 8},
  colSym: {flex: 1, minWidth: 64},
  colTv: {width: 28, alignItems: 'center', justifyContent: 'center'},
  colLvl: {flex: 1, minWidth: 68},
  cfSym: {width: 88},
  cfTv: {width: 28, alignItems: 'center', justifyContent: 'center'},
  cfSector: {width: 96},
  cfNum: {width: 72, textAlign: 'right'},
  cfRs: {width: 64, textAlign: 'right'},
  cfDi: {width: 44, textAlign: 'right'},
  cfRating: {width: 64, textAlign: 'center'},
  cfHorizon: {width: 80},
  trSym: {width: 72},
  trTv: {width: 28, alignItems: 'center', justifyContent: 'center'},
  trNum: {width: 72, textAlign: 'right'},
  trTier: {width: 40},
  trFresh: {borderLeftWidth: 3, borderLeftColor: '#2563eb'},
  trPass: {backgroundColor: '#ecfdf5'},
  rsPos: {color: AYC.positive},
  symBold: {fontWeight: '800'},
  thRow: {flexDirection: 'row', backgroundColor: AYC.appBar, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 8},
  th: mobileStyles.th,
  tr: {flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center'},
  trAlt: {backgroundColor: '#f0fdf4'},
  trBull: {backgroundColor: '#f0fdf4'},
  trBear: {backgroundColor: '#fff1f2'},
  td: mobileStyles.td,
  btn: {backgroundColor: AYC.appBar, paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginTop: 8},
  btnGhost: {backgroundColor: 'transparent', borderWidth: 1, borderColor: AYC.accent},
  btnTxt: {color: '#fff', fontWeight: '800', fontSize: AYC.type.body},
  rowInp: {flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap'},
  inp: {
    flex: 1,
    minWidth: 120,
    borderWidth: 1,
    borderColor: AYC.cardBorder,
    borderRadius: 10,
    padding: 10,
    fontSize: AYC.type.body,
    color: AYC.text,
    backgroundColor: AYC.card,
  },
  rowBtn: {flexDirection: 'row', gap: 10},
  aiBox: {backgroundColor: AYC.accentSoft, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: AYC.cardBorder},
  aiTypeTag: {fontSize: AYC.type.caption, fontWeight: '800', color: AYC.accent, marginBottom: 4},
  aiRating: {fontSize: AYC.type.metricSm, fontWeight: '900', color: AYC.positive},
  fieldLabel: {fontSize: AYC.type.caption, fontWeight: '800', color: AYC.textMuted, marginTop: 8},
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: AYC.cardBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: AYC.card,
  },
  selectBtnText: {fontSize: AYC.type.body, fontWeight: '800', color: AYC.text},
  selectBtnCaret: {fontSize: 16, color: AYC.accent, fontWeight: '800'},
  holdingsEmpty: {fontSize: AYC.type.caption, color: AYC.textMuted, fontStyle: 'italic', paddingVertical: 6},
  healthActions: {flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap'},
  healthCount: {fontSize: AYC.type.caption, color: AYC.textMuted, fontWeight: '700'},
  healthTable: {marginTop: 10, gap: 2},
  aiConf: {fontSize: AYC.type.body, fontWeight: '700', marginTop: 4},
  aiSum: {fontSize: AYC.type.body, color: AYC.text, marginTop: 8, lineHeight: 18},
  blockTitle: {fontSize: AYC.type.metricSm, fontWeight: '800', marginTop: 12, color: AYC.text},
  healthBox: {backgroundColor: AYC.accentSoft, padding: 12, borderRadius: 12, marginTop: 8},
  healthTxt: {fontSize: AYC.type.body, color: AYC.text, lineHeight: 20},
});
