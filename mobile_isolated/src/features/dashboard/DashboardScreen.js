import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View} from 'react-native';
import {MobileChrome} from '@components/mobileChrome/MobileChrome';
import {MarketIndexCardsRow} from '@components/MarketIndexCardsRow';
import {brokersService} from '@core/api/services/brokersService';
import {dashboardService} from '@core/api/services/dashboardService';
import {useAuth} from '@core/auth/AuthContext';
import {clearPageCache, readPageCache} from '@core/storage/pageCache';
import {readDashboardCache, writeDashboardCache} from '@core/storage/dashboardCache';
import {isDashboardCacheIncomplete, MOBILE_PAGE_CACHE_KEYS} from '@core/utils/dashboardCachePolicy';
import {
  ensureMarketSession,
  isPageCacheStale,
  shouldPollLiveMarket,
  shouldSkipNetworkForClosedMarket,
} from '@core/utils/marketSession';
import {AYC} from '@core/theme/aycMobileTheme';
import {extractApiRows} from '@core/utils/apiPayload';
import {parsePercentLike} from '@core/utils/outlookPayload';
import {safeFetch} from '@core/utils/safeFetch';
import {navigateToMainTab} from '@nav/navigationHelpers';

const API_MS = 8000;
const DASHBOARD_CACHE_KEY = MOBILE_PAGE_CACHE_KEYS.dashboard;

function parseStockList(res) {
  return extractApiRows(res, ['stocks']);
}

function stockPct(row) {
  if (row?.day1dNum != null) return row.day1dNum;
  const v = parsePercentLike(row?.day1d ?? row?.day_1d ?? row?.perf_1d ?? row?.change_pct ?? row?.pct_change);
  return v;
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

function applyBrokerSetup(brokersSetup) {
  const brokerRows = extractApiRows(brokersSetup);
  return brokerRows.some(b => b && b.live_enabled === true);
}

function applyDashboardState(setData, setBrokerConnected, cached) {
  if (!cached) return;
  setData(cached.data || cached);
  setBrokerConnected(Boolean(cached.brokerConnected ?? cached.data?.brokerConnected));
}

export const DashboardScreen = ({navigation}) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState({});
  const [brokerConnected, setBrokerConnected] = useState(false);
  const [error, setError] = useState('');
  const cacheHydrated = useRef(false);
  const {logout, user} = useAuth();

  const loadData = useCallback(async ({silent = false, forceRefresh = false} = {}) => {
    if (!silent && !cacheHydrated.current) {
      setLoading(true);
    } else if (forceRefresh) {
      setRefreshing(true);
    }
    setError('');

    try {
      const session = await ensureMarketSession();
      const liveSession = shouldPollLiveMarket(session);
      const cachedWrap = await readPageCache(DASHBOARD_CACHE_KEY);
      const cached = cachedWrap?.data || null;
      const cacheStale = forceRefresh || isPageCacheStale(cachedWrap?.updatedAt, session);
      const cacheIncomplete = isDashboardCacheIncomplete(cached);

      if (cached && !forceRefresh) {
        applyDashboardState(setData, setBrokerConnected, cached);
        cacheHydrated.current = true;
        setLoading(false);
      }

      if (liveSession || cacheStale || cacheIncomplete) {
        if (cacheStale || cacheIncomplete) {
          await clearPageCache(DASHBOARD_CACHE_KEY);
        }
      }

      const skipNetwork =
        !forceRefresh
        && !liveSession
        && !cacheStale
        && !cacheIncomplete
        && cached
        && shouldSkipNetworkForClosedMarket(cachedWrap?.updatedAt, true);
      if (skipNetwork) {
        return;
      }

      const apiOpts = {timeoutMs: API_MS};
      const [indices, watchlist] = await Promise.all([
        safeFetch(() => dashboardService.fetchMarketIndices(apiOpts), {timeoutMs: API_MS, label: 'Indices'}),
        safeFetch(() => dashboardService.fetchWatchlist(apiOpts), {timeoutMs: API_MS, label: 'Watchlist'}),
      ]);

      const partial = {indices, watchlist};
      setData(prev => ({...prev, ...partial}));
      setLoading(false);

      const [alerts, gainers, losers, signals, brokersSetup] = await Promise.all([
        safeFetch(() => dashboardService.fetchAdvisorAlerts(apiOpts), {timeoutMs: API_MS, label: 'Alerts'}),
        safeFetch(
          () => dashboardService.fetchPriceShockers({type: 'gainers', period: 'day', timeoutMs: API_MS}),
          {timeoutMs: API_MS, label: 'Gainers'},
        ),
        safeFetch(
          () => dashboardService.fetchPriceShockers({type: 'losers', period: 'day', timeoutMs: API_MS}),
          {timeoutMs: API_MS, label: 'Losers'},
        ),
        safeFetch(() => dashboardService.fetchWatchlistSignals(apiOpts), {timeoutMs: API_MS, label: 'Signals'}),
        safeFetch(() => brokersService.fetchBrokerSetup({timeoutMs: API_MS}), {timeoutMs: API_MS, label: 'Broker'}),
      ]);

      const nextData = {indices, watchlist, alerts, gainers, losers, signals};
      const nextBroker = applyBrokerSetup(brokersSetup);
      setData(nextData);
      setBrokerConnected(nextBroker);
      await writeDashboardCache({data: nextData, brokerConnected: nextBroker});
      cacheHydrated.current = true;
    } catch (e) {
      if (!cacheHydrated.current) {
        setError(String(e?.message || e || 'Dashboard data load failed'));
      }
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const cached = await readDashboardCache();
      if (!mounted) return;
      if (cached?.data) {
        cacheHydrated.current = true;
        setData(cached.data);
        setBrokerConnected(Boolean(cached.brokerConnected));
        setLoading(false);
      }
      loadData({silent: cacheHydrated.current});
    })();
    return () => {
      mounted = false;
    };
  }, [loadData]);

  const indices = useMemo(() => (Array.isArray(data.indices) ? data.indices : extractApiRows(data.indices)), [data.indices]);
  const watchlistAll = useMemo(() => extractApiRows(data.watchlist, ['watchlist', 'rows']), [data.watchlist]);
  const watchlist = useMemo(() => watchlistAll.slice(0, 5), [watchlistAll]);
  const gainers = useMemo(() => parseStockList(data.gainers).slice(0, 2), [data.gainers]);
  const losers = useMemo(() => parseStockList(data.losers).slice(0, 2), [data.losers]);
  const signals = useMemo(() => extractApiRows(data.signals), [data.signals]);
  const alertsCount = useMemo(() => extractApiRows(data.alerts).length, [data.alerts]);

  const snapshot = useMemo(() => {
    const rowsWithDay = watchlistAll.filter(w => stockPct(w) != null);
    const avg1d = rowsWithDay.length
      ? rowsWithDay.reduce((sum, w) => sum + Number(stockPct(w)), 0) / rowsWithDay.length
      : null;
    const scored = watchlistAll.filter(w => Number.isFinite(Number(w?.composite_score)));
    const avgScore = scored.length
      ? scored.reduce((sum, w) => sum + Number(w.composite_score), 0) / scored.length
      : null;
    const advance = rowsWithDay.filter(w => Number(stockPct(w)) > 0).length;
    const decline = rowsWithDay.filter(w => Number(stockPct(w)) < 0).length;
    const bullish = signals.filter(s => Number(s?.signal_score) > 25).length;
    const bearish = signals.filter(s => Number(s?.signal_score) < -25).length;
    const nearEntry = watchlistAll.filter(w => /near entry/i.test(String(w?.recommendation || ''))).length;
    return {avg1d, avgScore, advance, decline, bullish, bearish, nearEntry};
  }, [signals, watchlistAll]);

  const split = useMemo(() => {
    const buy = Math.max(1, snapshot.bullish || gainers.length);
    const hold = Math.max(1, watchlistAll.length - (snapshot.bullish || 0));
    const near = Math.max(1, snapshot.nearEntry || alertsCount);
    const total = buy + hold + near;
    return {
      buy,
      hold,
      near,
      buyPct: (buy / total) * 100,
      holdPct: (hold / total) * 100,
      nearPct: (near / total) * 100,
    };
  }, [alertsCount, gainers.length, snapshot.bullish, snapshot.nearEntry, watchlistAll.length]);

  if (loading) {
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

        <Text style={styles.sectionTitle}>MARKET OVERVIEW</Text>
        <MarketIndexCardsRow items={indices} onPress={() => navigateToMainTab(navigation, 'Stocks', {outlookTab: 'market'})} />

        <Text style={styles.sectionTitle}>PORTFOLIO SNAPSHOT - 5 STOCKS</Text>
        {!brokerConnected ? (
          <View style={styles.brokerGateCard}>
            <Text style={styles.brokerGateTitle}>Broker not connected</Text>
            <Text style={styles.brokerGateText}>Connect your broker to view portfolio snapshot metrics.</Text>
            <Pressable onPress={() => navigation.navigate('Brokers')} style={styles.brokerGateBtn}>
              <Text style={styles.brokerGateBtnText}>Connect broker</Text>
            </Pressable>
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

        <Text style={styles.sectionTitle}>SIGNALS & ALERTS</Text>
        <View style={styles.signalRow}>
          <View style={styles.signalCardGood}><Text style={styles.signalHead}>Best Today</Text>{gainers.map((r, i) => <Text key={`g-${i}`} style={styles.signalLine}>{stockLabel(r)}  {formatPct(stockPct(r))}</Text>)}</View>
          <View style={styles.signalCardBad}><Text style={styles.signalHead}>Worst Today</Text>{losers.map((r, i) => <Text key={`l-${i}`} style={styles.signalLine}>{stockLabel(r)}  {formatPct(stockPct(r))}</Text>)}</View>
        </View>

        <Text style={styles.sectionTitle}>RECOMMENDATION SPLIT</Text>
        <View style={styles.card}>
          <View style={styles.splitRow}><Text style={styles.splitLabel}>BUY</Text><View style={styles.barBg}><View style={[styles.barFill, {width: `${split.buyPct}%`, backgroundColor: '#22c55e'}]} /></View></View>
          <View style={styles.splitRow}><Text style={styles.splitLabel}>HOLD</Text><View style={styles.barBg}><View style={[styles.barFill, {width: `${split.holdPct}%`, backgroundColor: '#f59e0b'}]} /></View></View>
          <View style={styles.splitRow}><Text style={styles.splitLabel}>NEAR ENTRY</Text><View style={styles.barBg}><View style={[styles.barFill, {width: `${split.nearPct}%`, backgroundColor: '#3b82f6'}]} /></View></View>
        </View>

        <Text style={styles.sectionTitle}>MY HOLDINGS</Text>
        <View style={styles.card}>
          {watchlist.length ? watchlist.map((w, i) => <Text key={`w-${i}`} style={styles.holdLine}>{stockLabel(w)}</Text>) : <Text style={styles.muted}>No holdings data.</Text>}
        </View>

        <View style={styles.toolbar}>
          <Pressable onPress={() => navigation.navigate('Alerts')} style={styles.toolBtn}><Text style={styles.toolBtnText}>Help</Text></Pressable>
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
  barBg: {flex: 1, height: 8, backgroundColor: '#f1f5f9', borderRadius: 99},
  barFill: {height: 8, borderRadius: 99},
  holdLine: {fontSize: 12, fontWeight: '700', color: AYC.text, paddingVertical: 4},
  muted: {fontSize: 12, color: AYC.textMuted},
  toolbar: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6},
  toolBtn: {paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: AYC.card, borderWidth: 1, borderColor: AYC.cardBorder},
  toolBtnText: {color: AYC.text, fontWeight: '700', fontSize: 13},
  toolBtnDanger: {backgroundColor: '#fee2e2', borderColor: '#fecaca'},
  toolBtnDangerText: {color: '#991b1b', fontWeight: '700', fontSize: 13},
});
