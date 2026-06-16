import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {MobileChrome} from '@components/mobileChrome/MobileChrome';
import {TradeProductPicker} from '@components/TradeProductPicker';
import {TradingViewLink} from '@components/TradingViewLink';
import {useAuth} from '@core/auth/AuthContext';
import {extractApiRows} from '@core/utils/apiPayload';
import {alertsService} from '@core/api/services/alertsService';
import {fireDemoSignalAlert} from '@core/utils/signalNotifications';
import {MOBILE_PAGE_CACHE_KEYS} from '@core/utils/dashboardCachePolicy';
import {fetchMobileSignalsTabRows} from '@core/utils/advisorHubCache';
import {hydrateFromPageCache} from '@core/utils/pageCacheHydration';
import {runScreenTableFetch, shouldRefreshPageCache} from '@core/utils/screenPageLoader';
import {startTradeFromAlert} from '@core/utils/startTradeFromAlert';
import {inferAlertSide} from '@core/utils/tradePreflight';
import {AYC, mobilePad, mobileStyles} from '@core/theme/mobileStyles';
import {ListPagePager} from '@components/ListPagePager';
import {usePagedList} from '@hooks/usePagedList';

const SIGNALS_PAGE_SIZE = 10;

function dedupeSignalsBySymbol(rows) {
  const seen = new Set();
  const out = [];
  for (const row of rows || []) {
    const sym = String(row?.symbol || '').trim().toUpperCase();
    if (!sym || seen.has(sym)) continue;
    seen.add(sym);
    out.push(row);
  }
  return out;
}

const FILTERS = [
  {id: 'all', label: 'All'},
  {id: 'entry_ready', label: 'Entry ready'},
  {id: 'high', label: 'High conviction'},
];

function formatINR(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  const v = Number(n);
  try {
    return `₹${v.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
  } catch {
    return `₹${v.toFixed(2)}`;
  }
}

function SignalCard({item, onTrade}) {
  const trend = String(item.trend || '').toLowerCase();
  const bull = trend === 'bullish';
  const status = String(item.status || '');
  const pct = item.pct_from_entry;
  const pctColor = pct > 0 ? '#15803d' : pct < 0 ? '#b91c1c' : '#374151';
  const statusStyle =
    status === 'entry_ready'
      ? styles.badgeEntry
      : status === 'in_trade'
        ? styles.badgeTrade
        : status === 'done'
          ? styles.badgeDone
          : styles.badgeWatch;

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.tags}>
          {item.high_conviction ? <Text style={styles.tagHi}>High conviction</Text> : null}
          <Text style={styles.tagEq}>{bull ? 'Equity · Bull' : 'Equity · Bear'}</Text>
        </View>
        <Text style={[styles.badgeStatus, statusStyle]}>{status.replace(/_/g, ' ')}</Text>
      </View>
      <View style={styles.symRow}>
        <TradingViewLink symbol={item.symbol} size={16} />
        <Text style={styles.sym}>{item.symbol}</Text>
      </View>
      <Text style={styles.cmpRow}>
        <Text style={styles.cmp}>Live {formatINR(item.cmp)}</Text>
        {pct != null ? (
          <Text style={[styles.pct, {color: pctColor}]}>
            {' '}
            ({pct > 0 ? '+' : ''}
            {pct}% vs entry)
          </Text>
        ) : null}
      </Text>
      <View style={styles.railWrap}>
        <View style={styles.rail}>
          <View style={[styles.railSeg, {flex: 1, backgroundColor: '#fecaca'}]} />
          <View style={[styles.railSeg, {flex: 1.2, backgroundColor: '#bbf7d0'}]} />
          <View style={[styles.railSeg, {flex: 1, backgroundColor: '#bbf7d0'}]} />
        </View>
        <View style={styles.railLabels}>
          <Text style={styles.railLab}>SL {formatINR(item.stop_loss)}</Text>
          <Text style={styles.railLab}>Entry {formatINR(item.entry_price)}</Text>
          <Text style={styles.railLab}>T1 {formatINR(item.target_1)}</Text>
        </View>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.meta}>Score {item.conviction_score ?? item.signal_score ?? '—'}</Text>
        {item.target_2 ? <Text style={styles.meta}>T2 {formatINR(item.target_2)}</Text> : null}
      </View>
      {onTrade ? (
        <Pressable style={styles.tradeBtn} onPress={() => onTrade(item)}>
          <Text style={styles.tradeBtnText}>Trade this signal</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function SignalsScreen({navigation}) {
  const {user} = useAuth();
  const userId = String(user?.id || user?.user_id || '');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);
  const [tradePickerSignal, setTradePickerSignal] = useState(null);
  const [demoBusy, setDemoBusy] = useState(false);
  const initialLoadDone = useRef(false);

  const load = useCallback(async ({silent = false, forceRefresh = false} = {}) => {
    setError('');
    if (forceRefresh) {
      setRefreshing(true);
    }

    await runScreenTableFetch({
      cacheKey: MOBILE_PAGE_CACHE_KEYS.advisorSignals,
      fetcher: () => fetchMobileSignalsTabRows(),
      setRows,
      setLoading: silent && !forceRefresh ? () => {} : setLoading,
      setError: msg => setError(msg || ''),
      forceNetwork: forceRefresh,
      silent: silent && !forceRefresh,
    });

    setRefreshing(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const hadCache = await hydrateFromPageCache(MOBILE_PAGE_CACHE_KEYS.advisorSignals, {
        apply: data => setRows(Array.isArray(data) ? data : extractApiRows(data)),
        hasUsable: data => Array.isArray(data) && data.length > 0,
      });
      if (cancelled) return;
      await load({silent: hadCache});
      initialLoadDone.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (!initialLoadDone.current) return undefined;
      (async () => {
        const stale = await shouldRefreshPageCache(MOBILE_PAGE_CACHE_KEYS.advisorSignals);
        if (stale || !rows.length) {
          await load({silent: rows.length > 0});
        }
      })();
      return undefined;
    }, [load, rows.length]),
  );

  const [filter, setFilter] = useState('all');

  const filtered = useMemo(() => {
    const deduped = dedupeSignalsBySymbol(rows);
    if (filter === 'entry_ready') {
      return deduped.filter(r => String(r.status) === 'entry_ready');
    }
    if (filter === 'high') {
      return deduped.filter(r => r.high_conviction);
    }
    return deduped;
  }, [rows, filter]);

  const {page, setPage, totalPages, pagedItems, totalItems} = usePagedList(filtered, {
    pageSize: SIGNALS_PAGE_SIZE,
    resetDeps: [filter],
  });

  const onRefresh = useCallback(() => {
    load({silent: true, forceRefresh: true});
  }, [load]);

  const onDemoAlert = useCallback(async () => {
    if (demoBusy) return;
    setDemoBusy(true);
    try {
      const res = await alertsService.createDummyDemoAlert();
      const signal = res?.signal;
      await fireDemoSignalAlert({signal});
      if (signal) {
        setRows(prev => [signal, ...prev.filter(r => !r?._demo)]);
      }
      Alert.alert(
        'Demo alert sent',
        'Check your notification shade, the banner above the tabs, Stocks → Alerts, and this Signals list.',
      );
    } catch (e) {
      Alert.alert('Demo alert failed', String(e?.message || e));
    } finally {
      setDemoBusy(false);
    }
  }, [demoBusy]);

  const header = (
    <View style={styles.headBlock}>
      <View style={styles.headerCard}>
        <Image source={require('../../assets/ayc-logo.png')} style={styles.logo} />
        <Text style={styles.title}>Advisor signals</Text>
      </View>
      <View style={styles.chips}>
        {FILTERS.map(c => (
          <Pressable
            key={c.id}
            onPress={() => {
              setFilter(c.id);
              setPage(1);
            }}
            style={[styles.chip, filter === c.id ? styles.chipOn : styles.chipOff]}
          >
            <Text style={[styles.chipTxt, filter === c.id ? styles.chipTxtOn : styles.chipTxtOff]}>{c.label}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable
        style={[styles.demoBtn, demoBusy && styles.demoBtnBusy]}
        onPress={onDemoAlert}
        disabled={demoBusy}
      >
        {demoBusy ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.demoBtnText}>Try demo alert</Text>
        )}
      </Pressable>
      {error ? (
        <View style={styles.errWrap}>
          <Text style={styles.err}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => load()}>
            <Text style={styles.retryTxt}>Retry</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  const body =
    loading && !refreshing && rows.length === 0 ? (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={AYC.accent} />
        <Text style={styles.muted}>Loading signals…</Text>
      </View>
    ) : (
      <FlatList
        data={pagedItems}
        keyExtractor={(item, i) => `${item.symbol}-${i}`}
        style={styles.flex}
        contentContainerStyle={styles.listPad}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={header}
        ListEmptyComponent={<Text style={styles.muted}>No setups match this filter right now.</Text>}
        ListFooterComponent={
          <ListPagePager
            page={page}
            totalPages={totalPages}
            totalItems={totalItems}
            onPageChange={setPage}
          />
        }
        renderItem={({item}) => (
          <SignalCard item={item} onTrade={navigation ? signal => setTradePickerSignal(signal) : null} />
        )}
      />
    );

  const shell = (
    <>
      {body}
      <TradeProductPicker
        visible={Boolean(tradePickerSignal)}
        symbol={tradePickerSignal?.symbol}
        onClose={() => setTradePickerSignal(null)}
        onSelect={productType =>
          startTradeFromAlert(
            navigation,
            {
              ...tradePickerSignal,
              id: tradePickerSignal?.id || tradePickerSignal?.symbol,
              source: 'advisor_signal',
            },
            {
              productType,
              side: inferAlertSide(tradePickerSignal),
              userId,
            },
          )
        }
      />
    </>
  );

  if (navigation) {
    return <MobileChrome navigation={navigation}>{shell}</MobileChrome>;
  }

  return <View style={styles.root}>{shell}</View>;
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: AYC.pageBg},
  flex: {flex: 1},
  center: {flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, padding: 24},
  muted: mobileStyles.caption,
  errWrap: {marginTop: 8, gap: 8},
  err: mobileStyles.err,
  retryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: AYC.appBar,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryTxt: {color: '#fff', fontWeight: '800', fontSize: AYC.type.caption},
  headBlock: {marginBottom: 8, paddingHorizontal: 4},
  headerCard: {
    backgroundColor: AYC.appBar,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: AYC.cardBorder,
    padding: 12,
    gap: 6,
    marginBottom: 10,
  },
  logo: {width: 180, height: 48, resizeMode: 'contain'},
  title: {fontSize: AYC.type.pageTitle, fontWeight: '800', color: AYC.appBarText},
  chips: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  chip: {paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1},
  chipOn: {backgroundColor: AYC.appBar, borderColor: AYC.appBar},
  chipOff: {backgroundColor: AYC.card, borderColor: AYC.cardBorder},
  chipTxt: {fontSize: AYC.type.body, fontWeight: '700'},
  chipTxtOn: {color: '#fff'},
  chipTxtOff: {color: AYC.text},
  demoBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#6366f1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 140,
    alignItems: 'center',
  },
  demoBtnBusy: {opacity: 0.7},
  demoBtnText: {color: '#fff', fontWeight: '800', fontSize: AYC.type.body},
  listPad: {...mobilePad, paddingHorizontal: 16, paddingBottom: 24},
  card: {...mobileStyles.card, borderRadius: 14, padding: 14, marginBottom: 4},
  cardTop: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6},
  tags: {flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1},
  tagHi: {
    fontSize: AYC.type.caption,
    fontWeight: '800',
    color: '#166534',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  tagEq: {
    fontSize: AYC.type.caption,
    fontWeight: '700',
    color: '#1e40af',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  badgeStatus: {
    fontSize: AYC.type.caption,
    fontWeight: '800',
    textTransform: 'capitalize',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  badgeEntry: {color: '#14532d', backgroundColor: '#bbf7d0'},
  badgeTrade: {color: '#1e3a8a', backgroundColor: '#bfdbfe'},
  badgeWatch: {color: '#92400e', backgroundColor: '#fef3c7'},
  badgeDone: {color: '#4b5563', backgroundColor: '#e5e7eb'},
  sym: mobileStyles.metricLg,
  symRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  cmpRow: {marginTop: 4},
  cmp: mobileStyles.metricMd,
  pct: mobileStyles.body,
  railWrap: {marginTop: 12},
  rail: {flexDirection: 'row', height: 6, borderRadius: 4, overflow: 'hidden'},
  railSeg: {height: 6},
  railLabels: {flexDirection: 'row', justifyContent: 'space-between', marginTop: 6},
  railLab: mobileStyles.caption,
  metaRow: {flexDirection: 'row', justifyContent: 'space-between', marginTop: 10},
  meta: mobileStyles.caption,
  tradeBtn: {marginTop: 10, backgroundColor: '#10b981', borderRadius: 10, paddingVertical: 10, alignItems: 'center'},
  tradeBtnText: {color: '#fff', fontWeight: '800', fontSize: AYC.type.body},
});
