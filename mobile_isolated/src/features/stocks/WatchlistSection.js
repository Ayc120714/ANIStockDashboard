import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SymbolAutocomplete} from '@components/SymbolAutocomplete';
import {SortableTableHeader} from '@components/SortableTableHeader';
import {TradingViewLink} from '@components/TradingViewLink';
import {AYC, mobileStyles} from '@core/theme/mobileStyles';
import {dashboardService} from '@core/api/services/dashboardService';
import {formatINR} from '@core/utils/formatMarket';
import {formatPct, stockRowPct} from '@core/utils/stockListPayload';
import {mergeSymbolOptions} from '@core/utils/symbolOptions';
import {sortRows} from '@core/utils/tableSort';
import {getWatchlistSortValue} from '@core/utils/screenSortValues';
import {useTableSort} from '@hooks/useTableSort';
import {MOBILE_PAGE_CACHE_KEYS} from '@core/utils/dashboardCachePolicy';
import {mergeWatchlistWithSignals} from '@core/utils/mergeWatchlistSignals';
import {navigateToStocksAlerts, navigateToStocksBrokers, navigateToStocksOrders} from '@nav/navigationHelpers';
import {readPageCache, writePageCache} from '@core/storage/pageCache';
import {API_TIMEOUT_MS} from '@core/config/apiTimeouts';
import {extractRowArray} from '@core/utils/screenPageLoader';

const WATCHLIST_FETCH_MS = API_TIMEOUT_MS.screen;

const PRODUCT_OPTIONS = [
  {value: 'INTRADAY', label: 'MIS (Intraday)'},
  {value: 'MARGIN', label: 'MTF (Margin)'},
  {value: 'DELIVERY', label: 'Delivery (CNC)'},
];
const ORDER_TYPES = [
  {value: 'MARKET', label: 'MARKET'},
  {value: 'LIMIT', label: 'LIMIT'},
];

function ratingBadgeStyle(rec) {
  const r = String(rec || '').toUpperCase();
  if (r.includes('BUY')) return {bg: '#dcfce7', fg: '#166534', t: r};
  if (r.includes('SELL')) return {bg: '#fee2e2', fg: '#991b1b', t: r};
  return {bg: '#ffedd5', fg: '#9a3412', t: r || '—'};
}

function ChipPicker({options, value, onSelect}) {
  return (
    <View style={styles.chipRow}>
      {options.map(opt => {
        const active = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            style={[styles.chip, active ? styles.chipActive : null]}
            onPress={() => onSelect(opt.value)}>
            <Text style={[styles.chipTxt, active ? styles.chipTxtActive : null]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function WatchlistSection({navigation, listType = 'long_term', embedded = false}) {
  const horizon = listType === 'short_term' ? 'short_term' : 'long_term';
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [symbolOptions, setSymbolOptions] = useState([]);
  const [sym, setSym] = useState('');
  const [side, setSide] = useState('BUY');
  const [productType, setProductType] = useState('INTRADAY');
  const [orderType, setOrderType] = useState('MARKET');
  const {sortConfig, onSort} = useTableSort('day1d', false);

  const cacheKey = MOBILE_PAGE_CACHE_KEYS.watchlist(horizon);

  const fetchWatchlistRows = useCallback(async () => {
    return dashboardService.fetchWatchlistByListType(horizon, {timeoutMs: WATCHLIST_FETCH_MS});
  }, [horizon]);

  const mergeSignalsIntoRows = useCallback(async baseRows => {
    try {
      const sigs = await dashboardService.fetchWatchlistSignals({
        timeframe: 'intraday',
        timeoutMs: WATCHLIST_FETCH_MS,
      });
      const merged = mergeWatchlistWithSignals(baseRows, sigs);
      setRows(merged);
      await writePageCache(cacheKey, merged);
    } catch (_) {
      // Keep base watchlist rows; intraday signals are optional enrichment.
    }
  }, [cacheKey]);

  const loadSymbols = useCallback(async () => {
    try {
      setSymbolOptions(await dashboardService.fetchAvailableSymbols({timeoutMs: WATCHLIST_FETCH_MS}));
    } catch (_) {
      setSymbolOptions([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoadError(null);
      const cached = await readPageCache(cacheKey);
      const hasCached = cached?.data != null;
      const cachedRows = hasCached ? extractRowArray(cached.data) : null;
      if (hasCached) {
        setRows(cachedRows);
        setLoading(false);
      } else {
        setLoading(true);
      }

      try {
        const wl = await fetchWatchlistRows();
        if (cancelled) return;
        const baseRows = Array.isArray(wl) ? wl : [];
        setRows(baseRows);
        setLoading(false);
        setLoadError(null);
        await writePageCache(cacheKey, baseRows);
        mergeSignalsIntoRows(baseRows);
      } catch (e) {
        if (cancelled) return;
        if (!hasCached) {
          setRows([]);
          setLoadError(e?.message || 'Failed to load watchlist.');
        }
        setLoading(false);
      }
    })();

    const symTimer = setTimeout(() => {
      loadSymbols();
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(symTimer);
    };
  }, [cacheKey, fetchWatchlistRows, loadSymbols, mergeSignalsIntoRows]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setLoadError(null);
    try {
      const wl = await fetchWatchlistRows();
      const baseRows = Array.isArray(wl) ? wl : [];
      setRows(baseRows);
      await writePageCache(cacheKey, baseRows);
      await mergeSignalsIntoRows(baseRows);
    } catch (e) {
      setLoadError(e?.message || 'Failed to refresh watchlist.');
    } finally {
      setRefreshing(false);
    }
  }, [cacheKey, fetchWatchlistRows, mergeSignalsIntoRows]);

  const sortedRows = useMemo(
    () => sortRows(rows, sortConfig, (row, key) => getWatchlistSortValue(row, key, horizon)),
    [horizon, rows, sortConfig],
  );

  const mergedSymbolOptions = useMemo(
    () => mergeSymbolOptions(symbolOptions, rows.map(r => r?.symbol).filter(Boolean)),
    [rows, symbolOptions],
  );

  useEffect(() => {
    if (sym || !rows.length) return;
    setSym(String(rows[0]?.symbol || '').toUpperCase());
  }, [rows, sym]);

  const entryHint = row => {
    const e = row?.entry_price;
    const t1 = row?.target_short_term ?? row?.target_long_term;
    if (e != null && t1 != null) return `${formatINR(e)} → ${formatINR(t1)}`;
    if (e != null) return `${formatINR(e)}`;
    return '—';
  };

  const trendColor = t => (String(t || '').toLowerCase() === 'bullish' ? '#15803d' : '#b91c1c');

  const openOrders = () => {
    navigateToStocksOrders(navigation, {
      symbol: sym,
      side,
      productType: productType === 'MARGIN' ? 'MTF' : productType,
      orderType,
    });
  };

  return (
    <View style={[styles.wrap, embedded ? styles.wrapEmbedded : null]}>
      {!embedded ? (
        <View style={styles.headRow}>
          <Text style={styles.screenTitle}>
            {horizon === 'short_term' ? 'Short Term Watchlist' : 'Long Term Watchlist'}
          </Text>
          <Text style={styles.refreshHint}>Live refresh during market hours</Text>
        </View>
      ) : null}

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Trade action panel</Text>
        <View style={styles.btnRow}>
          <Pressable style={[styles.sq, side === 'BUY' ? styles.buySq : styles.buySqMuted]} onPress={() => setSide('BUY')}>
            <Text style={styles.sqTxt}>B</Text>
          </Pressable>
          <Pressable style={[styles.sq, side === 'SELL' ? styles.sellSq : styles.sellSqMuted]} onPress={() => setSide('SELL')}>
            <Text style={styles.sqTxt}>S</Text>
          </Pressable>
          <Pressable style={styles.outlineBtn} onPress={() => navigateToStocksAlerts(navigation)}>
            <Text style={styles.outlineTxt}>Set alert</Text>
          </Pressable>
          <Pressable style={styles.outlineBtn} onPress={() => navigateToStocksBrokers(navigation)}>
            <Text style={styles.outlineTxt}>Broker</Text>
          </Pressable>
        </View>
        <SymbolAutocomplete
          value={sym}
          onChange={setSym}
          options={mergedSymbolOptions}
          placeholder="Search & select symbol…"
        />
        <ChipPicker options={PRODUCT_OPTIONS} value={productType} onSelect={setProductType} />
        <ChipPicker options={ORDER_TYPES} value={orderType} onSelect={setOrderType} />
        <Pressable style={styles.place} onPress={openOrders}>
          <Text style={styles.placeTxt}>Place order</Text>
        </Pressable>
      </View>

      {loadError ? <Text style={styles.loadErr}>{loadError}</Text> : null}

      {loading ? (
        <ActivityIndicator style={{marginTop: 16}} color={AYC.accent} />
      ) : (
        <FlatList
          data={sortedRows}
          keyExtractor={item => String(item.id || item.symbol)}
          style={styles.list}
          contentContainerStyle={{paddingBottom: 32}}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={
            <View style={styles.tableHead}>
              <SortableTableHeader label="Symbol" sortKey="symbol" sortConfig={sortConfig} onSort={onSort} style={{flex: 1.1}} />
              <SortableTableHeader label="CMP" sortKey="price" sortConfig={sortConfig} onSort={onSort} style={{flex: 0.9}} />
              <SortableTableHeader label="1D%" sortKey="day1d" sortConfig={sortConfig} onSort={onSort} style={{flex: 0.7}} />
              {horizon === 'short_term' ? (
                <>
                  <SortableTableHeader label="Tier" sortKey="buy_sell_tier" sortConfig={sortConfig} onSort={onSort} style={{flex: 0.5}} />
                  <SortableTableHeader label="RSI" sortKey="rsi" sortConfig={sortConfig} onSort={onSort} style={{flex: 0.6}} />
                  <SortableTableHeader label="Scr" sortKey="score" sortConfig={sortConfig} onSort={onSort} style={{flex: 0.5}} />
                </>
              ) : (
                <>
                  <SortableTableHeader label="Rating" sortKey="recommendation" sortConfig={sortConfig} onSort={onSort} style={{flex: 0.8}} />
                  <SortableTableHeader label="Trnd" sortKey="trend" sortConfig={sortConfig} onSort={onSort} style={{flex: 0.7}} />
                  <SortableTableHeader label="Entry" sortKey="entry" sortConfig={sortConfig} onSort={onSort} style={{flex: 1.2}} />
                </>
              )}
            </View>
          }
          renderItem={({item, index}) => {
            const pct = stockRowPct(item);
            const pc = pct == null ? AYC.textMuted : pct >= 0 ? AYC.positive : AYC.negative;
            const rs = ratingBadgeStyle(item.recommendation);
            const selected = String(item.symbol || '').toUpperCase() === String(sym || '').toUpperCase();
            return (
              <Pressable
                style={[styles.tr, index % 2 === 0 ? styles.trAlt : null, selected ? styles.trSelected : null]}
                onPress={() => setSym(String(item.symbol || '').toUpperCase())}>
                <View style={[styles.td, {flex: 1.1, flexDirection: 'row', alignItems: 'center'}]}>
                  <TradingViewLink symbol={item.symbol} size={14} />
                  <Text style={{fontWeight: '800', flex: 1}} numberOfLines={1}>
                    {item.symbol}
                  </Text>
                </View>
                <Text style={[styles.td, {flex: 0.9}]}>{formatINR(item.price)}</Text>
                <Text style={[styles.td, {flex: 0.7, color: pc, fontWeight: '700'}]}>{formatPct(pct)}</Text>
                {horizon === 'short_term' ? (
                  <>
                    <Text style={[styles.td, {flex: 0.5, fontWeight: '800', color: AYC.positive}]}>
                      {item.buy_sell_tier || '—'}
                    </Text>
                    <Text style={[styles.td, {flex: 0.6}]}>{item.rsi != null ? Number(item.rsi).toFixed(1) : '—'}</Text>
                    <Text style={[styles.td, {flex: 0.5}]}>{item.composite_score ?? '—'}</Text>
                  </>
                ) : (
                  <>
                    <View style={[styles.badge, {flex: 0.8, backgroundColor: rs.bg}]}>
                      <Text style={[styles.badgeTxt, {color: rs.fg}]} numberOfLines={1}>
                        {rs.t}
                      </Text>
                    </View>
                    <Text style={[styles.td, {flex: 0.7, color: trendColor(item.trend), fontWeight: '700'}]}>
                      {item.trend || '—'}
                    </Text>
                    <Text style={[styles.td, {flex: 1.2}]} numberOfLines={2}>
                      {entryHint(item)}
                    </Text>
                  </>
                )}
              </Pressable>
            );
          }}
          ListEmptyComponent={<Text style={styles.empty}>No watchlist rows for this horizon.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {flex: 1},
  wrapEmbedded: {minHeight: 420},
  headRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 4},
  screenTitle: {...mobileStyles.pageTitle, flex: 1},
  refreshHint: {fontSize: AYC.type.caption, fontWeight: '700', color: AYC.accent},
  panel: {
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: AYC.cardBorder,
    backgroundColor: AYC.card,
    gap: 8,
    zIndex: 30,
  },
  panelTitle: mobileStyles.cardTitle,
  btnRow: {flexDirection: 'row', gap: 8, alignItems: 'center'},
  sq: {width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center'},
  buySq: {backgroundColor: AYC.positive},
  buySqMuted: {backgroundColor: '#86efac'},
  sellSq: {backgroundColor: AYC.negative},
  sellSqMuted: {backgroundColor: '#fca5a5'},
  sqTxt: {color: '#fff', fontWeight: '900', fontSize: AYC.type.metricSm},
  outlineBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: AYC.accent,
  },
  outlineTxt: {fontSize: AYC.type.caption, fontWeight: '700', color: AYC.accent},
  chipRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: AYC.cardBorder,
    backgroundColor: AYC.card,
  },
  chipActive: {borderColor: AYC.accent, backgroundColor: '#eff6ff'},
  chipTxt: mobileStyles.chipText,
  chipTxtActive: {color: AYC.accent},
  place: {
    backgroundColor: AYC.appBar,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  placeTxt: {color: '#fff', fontWeight: '800', fontSize: AYC.type.metricMd},
  list: {marginTop: 12, flex: 1},
  tableHead: {
    flexDirection: 'row',
    backgroundColor: AYC.appBar,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  th: mobileStyles.th,
  tr: {flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 10, alignItems: 'center'},
  trAlt: {backgroundColor: '#f0fdf4'},
  trSelected: {backgroundColor: '#dbeafe', borderWidth: 1, borderColor: '#93c5fd'},
  td: mobileStyles.td,
  badge: {paddingHorizontal: 4, paddingVertical: 2, borderRadius: 6, alignSelf: 'center', justifyContent: 'center'},
  badgeTxt: {fontSize: AYC.type.cardLabel, fontWeight: '800', textAlign: 'center'},
  empty: {padding: 24, textAlign: 'center', color: AYC.textMuted, fontSize: AYC.type.body},
  loadErr: {marginTop: 8, fontSize: AYC.type.caption, color: AYC.negative, fontWeight: '700'},
});
