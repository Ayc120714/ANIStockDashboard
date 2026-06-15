import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {MobileChrome} from '@components/mobileChrome/MobileChrome';
import {HoldingsListSection} from '@components/HoldingsListSection';
import {MarketIndexCardsRow} from '@components/MarketIndexCardsRow';
import {brokersService} from '@core/api/services/brokersService';
import {advisorService} from '@core/api/services/advisorService';
import {dashboardService} from '@core/api/services/dashboardService';
import {useAuth} from '@core/auth/AuthContext';
import {readPageCache} from '@core/storage/pageCache';
import {readDashboardCache, writeDashboardCache} from '@core/storage/dashboardCache';
import {
  applyLiveSessionRefreshPolicy,
  hasDashboardMovers,
  MOBILE_PAGE_CACHE_KEYS,
  dashboardSectionsToRefresh,
} from '@core/utils/dashboardCachePolicy';
import {resolveDashboardBrokerHoldings} from '@core/utils/loadBrokerHoldings';
import {dedupeWatchlistBySymbol} from '@core/utils/watchlistPayload';
import {
  ensureMarketSession,
  getCachedMarketSession,
  getMarketPollingIntervalMs,
  isPageCacheStale,
  shouldPollLiveMarket,
} from '@core/utils/marketSession';
import {AYC} from '@core/theme/aycMobileTheme';
import {extractApiRows, parseSignalRows, parseWatchlistRows} from '@core/utils/apiPayload';
import {parsePercentLike} from '@core/utils/outlookPayload';
import {parseStockListResponse, stockRowPct} from '@core/utils/stockListPayload';
import {navigateToMainTab, navigateToStocksAlerts, navigateToStocksBrokers} from '@nav/navigationHelpers';

import {API_TIMEOUT_MS} from '@core/config/apiTimeouts';
import {fetchWithRetry} from '@core/utils/fetchWithRetry';

const DASHBOARD_CACHE_KEY = MOBILE_PAGE_CACHE_KEYS.dashboard;
const DASH_MS = API_TIMEOUT_MS.dashboardParallel;
const DASHBOARD_LIVE_POLL_MS = 30_000;

function fetchSection(shouldFetch, fetcher, fallback) {
  if (!shouldFetch) return Promise.resolve(fallback);
  return fetchWithRetry(fetcher, {retries: 1});
}

function parseStockList(res) {
  if (Array.isArray(res)) return res;
  return parseStockListResponse(res);
}

function parseWatchlist(res) {
  return parseWatchlistRows(res);
}

function parseSignals(res) {
  return parseSignalRows(res);
}

function stockPct(row) {
  const fromHelper = stockRowPct(row);
  if (fromHelper != null) return fromHelper;
  if (row?.day1dNum != null) return row.day1dNum;
  return parsePercentLike(row?.day1d ?? row?.day_1d ?? row?.perf_1d ?? row?.change_pct ?? row?.pct_change ?? row?.chg);
}

function formatPct(v) {
  if (v == null || Number.isNaN(Number(v))) return '--';
  const n = Number(v);
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

function stockLabel(row) {
  return row?.symbol || row?.ticker || row?.name || '--';
}

import {isAnyBrokerConnected} from '@core/utils/brokerConnection';

function parseWeeklyEntries(res) {
  if (Array.isArray(res)) return res;
  return extractApiRows(res, ['data', 'weekly_entries']);
}

function asRowArray(res, fallback = []) {
  return Array.isArray(res) ? res : Array.isArray(fallback) ? fallback : [];
}

function toList(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') return Object.values(raw);
  return [];
}

function watchlistDayPct(row) {
  if (row?.day1d != null && Number.isFinite(Number(row.day1d))) return Number(row.day1d);
  return stockPct(row);
}

function hasDashboardContent(payload) {
  if (!payload || typeof payload !== 'object') return false;
  const hasIndices = Array.isArray(payload.indices) && payload.indices.length > 0;
  return hasIndices && hasDashboardMovers(payload);
}

function isAuthFailureMessage(message) {
  const m = String(message || '').toLowerCase();
  return m.includes('session expired')
    || m.includes('unauthorized')
    || m.includes('missing bearer')
    || m.includes('invalid credentials')
    || m.includes('request failed: 401');
}

function settledValue(settled, fallback) {
  return settled?.status === 'fulfilled' ? settled.value : fallback;
}

function applyDashboardState(setData, setBrokerConnected, setHoldings, cached) {
  if (!cached) return;
  const payload = cached.data ?? cached;
  if (!payload || typeof payload !== 'object') return;
  setData(payload);
  setBrokerConnected(Boolean(cached.brokerConnected ?? payload.brokerConnected));
  setHoldings(Array.isArray(payload.holdings) ? payload.holdings : []);
}

export const DashboardScreen = ({navigation}) => {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState({});
  const [holdings, setHoldings] = useState([]);
  const [holdingsLoading, setHoldingsLoading] = useState(false);
  const [brokerConnected, setBrokerConnected] = useState(false);
  const [error, setError] = useState('');
  const cacheHydrated = useRef(false);
  const {logout, user, isAuthenticated} = useAuth();

  const userId = String(user?.id || user?.user_id || user?.email || '');

  const refreshBrokerHoldings = useCallback(
    async ({forceLive = false, silent = false} = {}) => {
      if (!userId) {
        setBrokerConnected(false);
        setHoldings([]);
        return;
      }
      if (!silent) setHoldingsLoading(true);
      try {
        const broker = await resolveDashboardBrokerHoldings(userId, {forceLive});
        setBrokerConnected(broker.authenticated);
        setHoldings(broker.rows || []);
        return broker;
      } finally {
        if (!silent) setHoldingsLoading(false);
      }
    },
    [userId],
  );

  const loadData = useCallback(async ({silent = false, forceRefresh = false} = {}) => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    setError('');

    let cachedPayload = {};
    let liveSession = false;

    try {
      const cachedWrap = await readPageCache(DASHBOARD_CACHE_KEY);
      const cached = cachedWrap?.data || null;
      cachedPayload = cached && typeof cached === 'object' ? cached : {};

      if (cached && !forceRefresh && hasDashboardContent(cachedPayload)) {
        applyDashboardState(setData, setBrokerConnected, setHoldings, cached);
        cacheHydrated.current = true;
        setLoading(false);
      } else if (!silent && !cacheHydrated.current) {
        setLoading(true);
      } else if (forceRefresh) {
        setRefreshing(true);
      }

      const session = getCachedMarketSession() || (await ensureMarketSession());
      liveSession = shouldPollLiveMarket(session);
      const cacheStale = forceRefresh || isPageCacheStale(cachedWrap?.updatedAt, session);

      if (!forceRefresh && cacheHydrated.current && !liveSession && !cacheStale) {
        refreshBrokerHoldings({silent: true});
        return;
      }

      const need = dashboardSectionsToRefresh(cachedPayload);
      applyLiveSessionRefreshPolicy(need, liveSession);
      if (!liveSession && cacheHydrated.current && !forceRefresh) {
        need.weekly = false;
        need.extras = false;
        need.optional = false;
      }
      const mergePartial = partial => {
        setData(prev => ({...prev, ...partial}));
        cacheHydrated.current = true;
        if (hasDashboardMovers(partial) || hasDashboardContent(partial)) {
          setLoading(false);
        }
      };

      let partial = {...cachedPayload};

      const rCritical = await Promise.allSettled([
        fetchSection(
          need.indices || forceRefresh || !cachedPayload.indices?.length,
          () => dashboardService.fetchMarketIndicesCards({timeoutMs: DASH_MS}),
          cachedPayload.indices ?? [],
        ),
        fetchSection(
          need.movers || forceRefresh,
          () => dashboardService.fetchPriceShockers({type: 'gainers', period: 'day', limit: 8, timeoutMs: DASH_MS}),
          cachedPayload.gainers ?? [],
        ),
        fetchSection(
          need.movers || forceRefresh,
          () => dashboardService.fetchPriceShockers({type: 'losers', period: 'day', limit: 8, timeoutMs: DASH_MS}),
          cachedPayload.losers ?? [],
        ),
      ]);

      const indicesRaw = settledValue(rCritical[0], cachedPayload.indices ?? []);
      partial.indices = Array.isArray(indicesRaw) && indicesRaw.length ? indicesRaw : cachedPayload.indices ?? [];
      partial.gainers = parseStockList(settledValue(rCritical[1], cachedPayload.gainers ?? []));
      partial.losers = parseStockList(settledValue(rCritical[2], cachedPayload.losers ?? []));
      mergePartial({
        indices: partial.indices,
        gainers: partial.gainers,
        losers: partial.losers,
      });

      const rCore = await Promise.allSettled([
        fetchSection(
          need.watchlist || forceRefresh,
          () => dashboardService.fetchWatchlist({timeoutMs: DASH_MS}),
          cachedPayload.watchlist ?? [],
        ),
        fetchSection(
          need.signals || forceRefresh,
          () => dashboardService.fetchWatchlistSignals({timeframe: 'intraday', timeoutMs: DASH_MS}),
          cachedPayload.signals ?? [],
        ),
      ]);

      partial.watchlist = parseWatchlist(settledValue(rCore[0], cachedPayload.watchlist ?? []));
      partial.signals = parseSignals(settledValue(rCore[1], cachedPayload.signals ?? []));
      mergePartial({
        watchlist: partial.watchlist,
        signals: partial.signals,
      });

      const coreAuthRejected = [...rCritical, ...rCore].every(
        r => r.status === 'rejected' && isAuthFailureMessage(r.reason?.message),
      );
      if (coreAuthRejected) {
        setError('Your session expired. Please sign in again to load dashboard data.');
        setLoading(false);
        return;
      }

      const rExtras = await Promise.allSettled([
        fetchSection(
          need.weekly || forceRefresh,
          () => advisorService.fetchAdvisorWeeklyEntries({limit: 25, max_entry_gap_pct: 5, timeoutMs: DASH_MS}),
          cachedPayload.weeklyData ?? [],
        ),
        fetchSection(
          need.extras || forceRefresh,
          () => dashboardService.fetchAdvisorAlerts({limit: 25, timeoutMs: DASH_MS}),
          cachedPayload.alerts ?? [],
        ),
        fetchSection(
          need.extras || forceRefresh,
          () => dashboardService.fetchAdvisorRatings({limit: 8, timeoutMs: DASH_MS}),
          cachedPayload.ratings ?? [],
        ),
        fetchSection(
          need.extras || forceRefresh,
          () => dashboardService.fetchTrending(20, {timeoutMs: DASH_MS}),
          cachedPayload.trending ?? [],
        ),
        fetchSection(
          need.optional || forceRefresh,
          () => dashboardService.fetchSectorOutlook({timeoutMs: DASH_MS}),
          cachedPayload.sectorOutlook ?? [],
        ),
        fetchSection(
          need.optional || forceRefresh,
          () => dashboardService.fetchWatchlistOrderBlocks({timeoutMs: DASH_MS}),
          cachedPayload.orderBlocks ?? [],
        ),
        fetchSection(
          true,
          () => brokersService.fetchBrokerSetup({userId, timeoutMs: DASH_MS}),
          null,
        ),
      ]);

      partial.weeklyData = parseWeeklyEntries(settledValue(rExtras[0], cachedPayload.weeklyData ?? []));
      partial.alerts = asRowArray(settledValue(rExtras[1], cachedPayload.alerts ?? []));
      partial.ratings = asRowArray(settledValue(rExtras[2], cachedPayload.ratings ?? []));
      partial.trending = parseStockList(settledValue(rExtras[3], cachedPayload.trending ?? []));
      partial.sectorOutlook = toList(settledValue(rExtras[4], cachedPayload.sectorOutlook ?? [])).slice(0, 6);
      partial.orderBlocks = asRowArray(settledValue(rExtras[5], cachedPayload.orderBlocks ?? []));
      const nextBroker = isAnyBrokerConnected(settledValue(rExtras[6], null));
      mergePartial({
        weeklyData: partial.weeklyData,
        alerts: partial.alerts,
        ratings: partial.ratings,
        trending: partial.trending,
        sectorOutlook: partial.sectorOutlook,
        orderBlocks: partial.orderBlocks,
      });
      setBrokerConnected(nextBroker);

      refreshBrokerHoldings({forceLive: forceRefresh || liveSession, silent: silent || cacheHydrated.current})
        .then(brokerHoldings => {
          const nextData = {
            ...partial,
            holdings: brokerHoldings?.rows || [],
            brokerConnected: brokerHoldings?.authenticated ?? nextBroker,
          };
          setData(nextData);
          setBrokerConnected(brokerHoldings?.authenticated ?? nextBroker);
          if (!hasDashboardContent(nextData) && !cacheHydrated.current) {
            setError(prev => prev || 'Dashboard data is unavailable. Pull down to refresh.');
          }
          if (hasDashboardContent(nextData)) {
            return writeDashboardCache({
              data: nextData,
              brokerConnected: brokerHoldings?.authenticated ?? nextBroker,
            });
          }
        })
        .catch(() => {
          if (hasDashboardContent(partial)) {
            writeDashboardCache({
              data: {...partial, brokerConnected: nextBroker},
              brokerConnected: nextBroker,
            });
          }
        });
    } catch (e) {
      if (!cacheHydrated.current) {
        setError(String(e?.message || e || 'Dashboard data load failed'));
      }
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [isAuthenticated, refreshBrokerHoldings, userId]);

  const initialLoadDone = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    let mounted = true;
    (async () => {
      const [pageCached, legacyCached] = await Promise.all([
        readPageCache(DASHBOARD_CACHE_KEY),
        readDashboardCache(),
      ]);
      if (!mounted) return;
      const payload = pageCached?.data || legacyCached?.data;
      if (payload && hasDashboardContent(payload)) {
        cacheHydrated.current = true;
        applyDashboardState(setData, setBrokerConnected, setHoldings, legacyCached || {data: payload});
        setLoading(false);
      }
      await loadData({silent: cacheHydrated.current});
      initialLoadDone.current = true;
    })();
    return () => {
      mounted = false;
    };
  }, [isAuthenticated, loadData]);

  useFocusEffect(
    useCallback(() => {
      if (!initialLoadDone.current) return undefined;
      (async () => {
        const session = getCachedMarketSession() || (await ensureMarketSession());
        const cachedWrap = await readPageCache(DASHBOARD_CACHE_KEY);
        const stale = isPageCacheStale(cachedWrap?.updatedAt, session);
        const cachedPayload = cachedWrap?.data || {};
        const needsData = !hasDashboardContent(cachedPayload);
        if ((shouldPollLiveMarket(session) && stale) || needsData) {
          await loadData({silent: !needsData});
        } else {
          refreshBrokerHoldings({forceLive: shouldPollLiveMarket(session), silent: true});
        }
      })();
      return undefined;
    }, [loadData, refreshBrokerHoldings]),
  );

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    let pollId;
    (async () => {
      await ensureMarketSession();
      const pollMs = getMarketPollingIntervalMs(DASHBOARD_LIVE_POLL_MS, 0);
      if (pollMs <= 0) return;
      pollId = setInterval(async () => {
        await ensureMarketSession();
        if (!shouldPollLiveMarket(getCachedMarketSession())) return;
        await loadData({silent: true});
      }, pollMs);
    })();
    return () => {
      if (pollId) clearInterval(pollId);
    };
  }, [isAuthenticated, loadData]);

  const indices = useMemo(() => {
    const raw = data.indices;
    if (Array.isArray(raw)) return raw;
    return extractApiRows(raw);
  }, [data.indices]);
  const watchlistAll = useMemo(
    () => dedupeWatchlistBySymbol(parseWatchlistRows(data.watchlist)),
    [data.watchlist],
  );
  const signals = useMemo(() => parseSignals(data.signals), [data.signals]);
  const weeklyData = useMemo(() => parseWeeklyEntries(data.weeklyData), [data.weeklyData]);
  const marketMovers = useMemo(
    () => ({
      gainers: parseStockList(data.gainers).slice(0, 5),
      losers: parseStockList(data.losers).slice(0, 5),
    }),
    [data.gainers, data.losers],
  );
  const advisorAlerts = useMemo(() => extractApiRows(data.alerts).slice(0, 5), [data.alerts]);
  const ratings = useMemo(() => extractApiRows(data.ratings).slice(0, 6), [data.ratings]);
  const trending = useMemo(() => parseStockList(data.trending).slice(0, 6), [data.trending]);
  const sectorOutlook = useMemo(() => toList(data.sectorOutlook).slice(0, 5), [data.sectorOutlook]);
  const orderBlocks = useMemo(() => extractApiRows(data.orderBlocks).slice(0, 5), [data.orderBlocks]);

  const snapshot = useMemo(() => {
    const rowsWithDay = watchlistAll.filter(w => watchlistDayPct(w) != null);
    const avg1d = rowsWithDay.length
      ? rowsWithDay.reduce((sum, w) => sum + Number(watchlistDayPct(w)), 0) / rowsWithDay.length
      : null;
    const scored = watchlistAll.filter(w => Number.isFinite(Number(w?.composite_score)));
    const avgScore = scored.length
      ? scored.reduce((sum, w) => sum + Number(w.composite_score), 0) / scored.length
      : null;
    const advance = rowsWithDay.filter(w => Number(watchlistDayPct(w)) > 0).length;
    const decline = rowsWithDay.filter(w => Number(watchlistDayPct(w)) < 0).length;
    const bullish = signals.filter(s => Number(s?.signal_score) > 25).length;
    const bearish = signals.filter(s => Number(s?.signal_score) < -25).length;
    const nearEntry = weeklyData.filter(
      w => (w.near_entry || (w.weekly_entry_gap_pct || 100) <= 10) && (w.weekly_entry_gap_pct || 100) <= 10,
    ).length;
    const best = rowsWithDay.reduce(
      (b, w) => (!b || Number(watchlistDayPct(w)) > Number(watchlistDayPct(b)) ? w : b),
      null,
    );
    const worst = rowsWithDay.reduce(
      (w2, w) => (!w2 || Number(watchlistDayPct(w)) < Number(watchlistDayPct(w2)) ? w : w2),
      null,
    );
    return {avg1d, avgScore, advance, decline, bullish, bearish, nearEntry, best, worst, stockCount: watchlistAll.length};
  }, [signals, watchlistAll, weeklyData]);

  const split = useMemo(() => {
    const recoMap = {};
    watchlistAll.forEach(w => {
      const key = String(w?.recommendation || '').toUpperCase().trim();
      if (key) recoMap[key] = (recoMap[key] || 0) + 1;
    });
    const buy = (recoMap['STRONG BUY'] || 0) + (recoMap.BUY || 0);
    const hold = recoMap.HOLD || 0;
    const near = recoMap['NEAR ENTRY'] || snapshot.nearEntry || 0;
    const sell = (recoMap.SELL || 0) + (recoMap['STRONG SELL'] || 0);
    const buyN = Math.max(0, buy);
    const holdN = Math.max(0, hold);
    const nearN = Math.max(0, near);
    const sellN = Math.max(0, sell);
    const total = buyN + holdN + nearN + sellN || 1;
    return {
      buy: buyN,
      hold: holdN,
      near: nearN,
      sell: sellN,
      buyPct: (buyN / total) * 100,
      holdPct: (holdN / total) * 100,
      nearPct: (nearN / total) * 100,
      sellPct: (sellN / total) * 100,
    };
  }, [snapshot.nearEntry, watchlistAll]);

  if (loading && !hasDashboardContent(data)) {
    return (
      <MobileChrome navigation={navigation}>
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={AYC.accent} />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </MobileChrome>
    );
  }

  return (
    <MobileChrome navigation={navigation}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.pad}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadData({silent: true, forceRefresh: true})} />
        }>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Dashboard</Text>
          <Pressable onPress={() => loadData({silent: true, forceRefresh: true})} disabled={refreshing}>
            <Text style={styles.refreshText}>{refreshing ? 'Updating…' : 'Refresh'}</Text>
          </Pressable>
        </View>
        {error ? <Text style={styles.errText}>{error}</Text> : null}
        {!hasDashboardContent(data) && !loading ? (
          <View style={styles.card}>
            <Text style={styles.muted}>No dashboard data loaded yet.</Text>
            <Pressable onPress={() => loadData({silent: true, forceRefresh: true})} style={styles.brokerGateBtn}>
              <Text style={styles.brokerGateBtnText}>Retry load</Text>
            </Pressable>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>MARKET OVERVIEW</Text>
        <MarketIndexCardsRow items={indices} onPress={() => navigateToMainTab(navigation, 'Stocks', {outlookTab: 'market'})} />

        <Text style={styles.sectionTitle}>PORTFOLIO SNAPSHOT ({snapshot.stockCount} STOCKS)</Text>
        {!snapshot.stockCount ? (
          <View style={styles.card}>
            <Text style={styles.muted}>No stocks in watchlist. Add stocks from Short Term or Long Term pages.</Text>
          </View>
        ) : (
          <View style={styles.snapGrid}>
            <View style={styles.snapTop}><Text style={styles.snapBig} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{formatPct(snapshot.avg1d)}</Text><Text style={styles.snapLbl}>Avg 1D Return</Text></View>
            <View style={styles.snapTop}><Text style={styles.snapBig} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{snapshot.avgScore != null ? Math.round(snapshot.avgScore) : '--'}</Text><Text style={styles.snapLbl}>Avg Score</Text></View>
            <View style={styles.snapSmall}><Text style={styles.snapNum}>{snapshot.advance}</Text><Text style={styles.snapLbl}>Advance</Text></View>
            <View style={styles.snapSmall}><Text style={styles.snapNum}>{snapshot.decline}</Text><Text style={styles.snapLbl}>Decline</Text></View>
            <View style={styles.snapSmall}><Text style={styles.snapNum}>{snapshot.bullish}</Text><Text style={styles.snapLbl}>Bullish</Text></View>
            <View style={styles.snapSmall}><Text style={styles.snapNum}>{snapshot.bearish}</Text><Text style={styles.snapLbl}>Bearish</Text></View>
            <View style={styles.snapSmall}><Text style={styles.snapNum}>{snapshot.nearEntry}</Text><Text style={styles.snapLbl}>Near Entry</Text></View>
          </View>
        )}

        <Text style={styles.sectionTitle}>WATCHLIST MOVERS</Text>
        <View style={styles.signalRow}>
          <View style={styles.signalCardGood}>
            <Text style={styles.signalHead}>Best Today</Text>
            {snapshot.best && Number(watchlistDayPct(snapshot.best)) > 0 ? (
              <Text style={styles.signalLine}>{stockLabel(snapshot.best)}  {formatPct(watchlistDayPct(snapshot.best))}</Text>
            ) : (
              <Text style={styles.muted}>—</Text>
            )}
          </View>
          <View style={styles.signalCardBad}>
            <Text style={styles.signalHead}>Worst Today</Text>
            {snapshot.worst && Number(watchlistDayPct(snapshot.worst)) < 0 ? (
              <Text style={styles.signalLine}>{stockLabel(snapshot.worst)}  {formatPct(watchlistDayPct(snapshot.worst))}</Text>
            ) : (
              <Text style={styles.muted}>—</Text>
            )}
          </View>
        </View>

        <Text style={styles.sectionTitle}>MARKET MOVERS</Text>
        <View style={styles.signalRow}>
          <View style={styles.signalCardGood}>
            <Text style={styles.signalHead}>Top Gainers</Text>
            {marketMovers.gainers.length ? marketMovers.gainers.map((r, i) => (
              <Text key={`g-${i}`} style={styles.signalLine}>{stockLabel(r)}  {formatPct(stockPct(r))}</Text>
            )) : <Text style={styles.muted}>—</Text>}
          </View>
          <View style={styles.signalCardBad}>
            <Text style={styles.signalHead}>Top Losers</Text>
            {marketMovers.losers.length ? marketMovers.losers.map((r, i) => (
              <Text key={`l-${i}`} style={styles.signalLine}>{stockLabel(r)}  {formatPct(stockPct(r))}</Text>
            )) : <Text style={styles.muted}>—</Text>}
          </View>
        </View>

        <Text style={styles.sectionTitle}>RECOMMENDATION SPLIT</Text>
        <View style={styles.card}>
          <View style={styles.splitRow}><Text style={styles.splitLabel}>BUY</Text><View style={styles.barBg}><View style={[styles.barFill, {width: `${split.buyPct}%`, backgroundColor: '#22c55e'}]} /></View><Text style={styles.splitCount}>{split.buy}</Text></View>
          <View style={styles.splitRow}><Text style={styles.splitLabel}>HOLD</Text><View style={styles.barBg}><View style={[styles.barFill, {width: `${split.holdPct}%`, backgroundColor: '#f59e0b'}]} /></View><Text style={styles.splitCount}>{split.hold}</Text></View>
          <View style={styles.splitRow}><Text style={styles.splitLabel}>NEAR ENTRY</Text><View style={styles.barBg}><View style={[styles.barFill, {width: `${split.nearPct}%`, backgroundColor: '#3b82f6'}]} /></View><Text style={styles.splitCount}>{split.near}</Text></View>
          {split.sell > 0 ? (
            <View style={styles.splitRow}><Text style={styles.splitLabel}>SELL</Text><View style={styles.barBg}><View style={[styles.barFill, {width: `${split.sellPct}%`, backgroundColor: '#ef4444'}]} /></View><Text style={styles.splitCount}>{split.sell}</Text></View>
          ) : null}
        </View>

        {advisorAlerts.length ? (
          <>
            <Text style={styles.sectionTitle}>ADVISOR ALERTS</Text>
            <View style={styles.card}>
              {advisorAlerts.map((a, i) => (
                <Text key={`alert-${i}`} style={styles.signalLine}>
                  {a.symbol || a.title || 'Alert'} · {a.message || a.alert_type || a.status || '—'}
                </Text>
              ))}
              <Pressable onPress={() => navigateToStocksAlerts(navigation)}>
                <Text style={styles.linkText}>View all alerts</Text>
              </Pressable>
            </View>
          </>
        ) : null}

        {trending.length ? (
          <>
            <Text style={styles.sectionTitle}>TRENDING</Text>
            <View style={styles.card}>
              {trending.map((r, i) => (
                <Text key={`tr-${i}`} style={styles.signalLine}>
                  {stockLabel(r)} · {formatPct(stockPct(r))}
                </Text>
              ))}
            </View>
          </>
        ) : null}

        {sectorOutlook.length ? (
          <>
            <Text style={styles.sectionTitle}>SECTOR OUTLOOK</Text>
            <View style={styles.card}>
              {sectorOutlook.map((s, i) => (
                <Text key={`sec-${i}`} style={styles.signalLine}>
                  {s.name || s.sector || '—'} · 1D {s.day1d ?? '—'} · 1W {s.week1w ?? '—'}
                </Text>
              ))}
              <Pressable onPress={() => navigateToMainTab(navigation, 'Stocks', {outlookTab: 'sector'})}>
                <Text style={styles.linkText}>Open sector insights</Text>
              </Pressable>
            </View>
          </>
        ) : null}

        {ratings.length ? (
          <>
            <Text style={styles.sectionTitle}>TOP RATINGS</Text>
            <View style={styles.card}>
              {ratings.map((r, i) => (
                <Text key={`rt-${i}`} style={styles.signalLine}>
                  {r.symbol || '—'} · {r.recommendation || r.rating || '—'}
                </Text>
              ))}
            </View>
          </>
        ) : null}

        {orderBlocks.length ? (
          <>
            <Text style={styles.sectionTitle}>ORDER BLOCKS</Text>
            <View style={styles.card}>
              {orderBlocks.map((b, i) => (
                <Text key={`ob-${i}`} style={styles.signalLine}>
                  {b.symbol || '—'} · {b.block_type || b.type || 'block'} · {b.price ?? b.zone ?? '—'}
                </Text>
              ))}
            </View>
          </>
        ) : null}

        <Text style={styles.sectionTitle}>
          MY HOLDINGS{holdings.length ? ` (${holdings.length})` : ''}
        </Text>
        <HoldingsListSection
          holdings={holdings}
          brokerConnected={brokerConnected}
          loading={holdingsLoading}
          onConnectBroker={() => navigateToStocksBrokers(navigation)}
        />

        <View style={styles.toolbar}>
          <Pressable onPress={() => navigateToStocksAlerts(navigation)} style={styles.toolBtn}><Text style={styles.toolBtnText}>Help</Text></Pressable>
          {user?.is_super_admin ? <Pressable onPress={() => navigation.navigate('Admin')} style={styles.toolBtn}><Text style={styles.toolBtnText}>Admin</Text></Pressable> : null}
          <Pressable onPress={logout} style={[styles.toolBtn, styles.toolBtnDanger]}><Text style={styles.toolBtnDangerText}>Logout</Text></Pressable>
        </View>
      </ScrollView>
    </MobileChrome>
  );
};

const styles = StyleSheet.create({
  scroll: {flex: 1},
  pad: {padding: 12, paddingBottom: 24, gap: 10},
  loadingState: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 220},
  loadingText: {fontSize: 14, color: AYC.textMuted},
  titleRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  title: {fontSize: AYC.type.pageTitle, fontWeight: '800', color: AYC.text},
  refreshText: {fontSize: 12, color: AYC.textMuted, fontWeight: '700'},
  errText: {fontSize: 12, color: AYC.negative, fontWeight: '700'},
  sectionTitle: {fontSize: AYC.type.sectionTitle, fontWeight: '800', color: AYC.textMuted, letterSpacing: 0.6, marginTop: 4},
  brokerGateCard: {
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 10,
    backgroundColor: '#fffbeb',
    padding: 12,
    gap: 6,
  },
  brokerGateTitle: {fontSize: 13, fontWeight: '800', color: '#92400e'},
  brokerGateText: {fontSize: 12, color: '#78350f', lineHeight: 18},
  brokerGateBtn: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#2563eb',
  },
  brokerGateBtnText: {color: '#fff', fontWeight: '800', fontSize: 12},
  snapGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  snapTop: {width: '48%', borderWidth: 1, borderColor: AYC.cardBorder, borderRadius: 8, backgroundColor: '#fff', padding: 8},
  snapBig: {fontSize: AYC.type.metricMd, fontWeight: '800', color: AYC.text},
  snapNum: {fontSize: AYC.type.metricLg, fontWeight: '800', color: AYC.text},
  snapLbl: {fontSize: AYC.type.cardLabel, color: AYC.textMuted, marginTop: 2},
  snapSmall: {width: '31%', borderWidth: 1, borderColor: AYC.cardBorder, borderRadius: 8, backgroundColor: '#fff', padding: 8},
  signalRow: {flexDirection: 'row', gap: 8},
  signalCardGood: {flex: 1, borderRadius: 8, borderWidth: 1, borderColor: '#bbf7d0', backgroundColor: '#f0fdf4', padding: 8},
  signalCardBad: {flex: 1, borderRadius: 8, borderWidth: 1, borderColor: '#fecaca', backgroundColor: '#fff1f2', padding: 8},
  signalHead: {fontSize: 10, fontWeight: '800', color: AYC.textMuted, marginBottom: 4},
  signalLine: {fontSize: 10, fontWeight: '700', color: AYC.text, marginBottom: 2},
  card: {borderWidth: 1, borderColor: AYC.cardBorder, borderRadius: 10, backgroundColor: '#fff', padding: 10, gap: 8},
  splitRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  splitLabel: {width: 70, fontSize: 10, fontWeight: '800', color: AYC.text},
  splitCount: {width: 24, fontSize: 10, fontWeight: '700', color: AYC.textMuted, textAlign: 'right'},
  barBg: {flex: 1, height: 8, backgroundColor: '#f1f5f9', borderRadius: 99},
  barFill: {height: 8, borderRadius: 99},
  muted: {fontSize: 12, color: AYC.textMuted},
  linkText: {fontSize: 12, fontWeight: '800', color: AYC.accent, marginTop: 4},
  toolbar: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6},
  toolBtn: {paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: AYC.card, borderWidth: 1, borderColor: AYC.cardBorder},
  toolBtnText: {color: AYC.text, fontWeight: '700', fontSize: 13},
  toolBtnDanger: {backgroundColor: '#fee2e2', borderColor: '#fecaca'},
  toolBtnDangerText: {color: '#991b1b', fontWeight: '700', fontSize: 13},
});
