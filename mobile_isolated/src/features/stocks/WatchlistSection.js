import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
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
import {normalizeWatchlistSymbol, watchlistService} from '@core/api/services/watchlistService';
import {formatINR} from '@core/utils/formatMarket';
import {formatPct, stockRowPct} from '@core/utils/stockListPayload';
import {mergeSymbolOptions} from '@core/utils/symbolOptions';
import {sortRows} from '@core/utils/tableSort';
import {getWatchlistSortValue} from '@core/utils/screenSortValues';
import {useTableSort} from '@hooks/useTableSort';
import {MOBILE_PAGE_CACHE_KEYS} from '@core/utils/dashboardCachePolicy';
import {mergeWatchlistWithSignals} from '@core/utils/mergeWatchlistSignals';
import {navigateToStocksAlerts, navigateToStocksBrokers, navigateToStocksOrders} from '@nav/navigationHelpers';
import {readPageCache, writePageCache, clearPageCache} from '@core/storage/pageCache';
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
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [symbolOptions, setSymbolOptions] = useState([]);
  const [sym, setSym] = useState('');
  const [addSym, setAddSym] = useState('');
  const [adding, setAdding] = useState(false);
  const [removingSym, setRemovingSym] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [side, setSide] = useState('BUY');
  const [productType, setProductType] = useState('INTRADAY');
  const [orderType, setOrderType] = useState('MARKET');
  const {sortConfig, onSort} = useTableSort('day1d', false);

  const cacheKey = MOBILE_PAGE_CACHE_KEYS.watchlist(horizon);
  const loadGenRef = useRef(0);

  const fetchWatchlistRows = useCallback(async (options = {}) => {
    return dashboardService.fetchWatchlistByListType(horizon, {
      timeoutMs: WATCHLIST_FETCH_MS,
      cacheBust: options?.cacheBust === true,
    });
  }, [horizon]);

  const mergeSignalsIntoRows = useCallback(async (baseRows, sigs, gen) => {
    if (gen != null && gen !== loadGenRef.current) return;
    try {
      const signals = sigs ?? await dashboardService.fetchWatchlistSignals({
        timeframe: 'intraday',
        timeoutMs: WATCHLIST_FETCH_MS,
      });
      if (gen != null && gen !== loadGenRef.current) return;
      const merged = mergeWatchlistWithSignals(baseRows, signals);
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
      const gen = ++loadGenRef.current;
      const cached = await readPageCache(cacheKey);
      const hasCached = cached?.data != null;
      const cachedRows = hasCached ? extractRowArray(cached.data) : null;
      if (hasCached) {
        setRows(cachedRows);
        setLoading(false);
        void (async () => {
          try {
            const wl = await fetchWatchlistRows();
            if (cancelled || gen !== loadGenRef.current) return;
            const baseRows = Array.isArray(wl) ? wl : [];
            setRows(baseRows);
            await writePageCache(cacheKey, baseRows);
            mergeSignalsIntoRows(baseRows, undefined, gen);
          } catch {
            /* keep cached rows */
          }
        })();
        return;
      }

      setLoading(true);
      try {
        const wl = await fetchWatchlistRows();
        if (cancelled || gen !== loadGenRef.current) return;
        const baseRows = Array.isArray(wl) ? wl : [];
        setRows(baseRows);
        setLoading(false);
        setLoadError(null);
        await writePageCache(cacheKey, baseRows);
        mergeSignalsIntoRows(baseRows, undefined, gen);
      } catch (e) {
        if (cancelled || gen !== loadGenRef.current) return;
        setRows([]);
        setLoadError(e?.message || 'Failed to load watchlist.');
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
    const gen = ++loadGenRef.current;
    setRefreshing(true);
    setLoadError(null);
    await clearPageCache(cacheKey);
    try {
      const [wlResult, sigResult] = await Promise.allSettled([
        fetchWatchlistRows({cacheBust: true}),
        dashboardService.fetchWatchlistSignals({
          timeframe: 'intraday',
          timeoutMs: WATCHLIST_FETCH_MS,
        }),
      ]);
      if (gen !== loadGenRef.current) return;
      const baseRows =
        wlResult.status === 'fulfilled' && Array.isArray(wlResult.value) ? wlResult.value : [];
      setRows(baseRows);
      await writePageCache(cacheKey, baseRows);
      if (sigResult.status === 'fulfilled') {
        await mergeSignalsIntoRows(baseRows, sigResult.value, gen);
      }
    } catch (e) {
      if (gen !== loadGenRef.current) return;
      setLoadError(e?.message || 'Failed to refresh watchlist.');
    } finally {
      if (gen === loadGenRef.current) setRefreshing(false);
    }
  }, [cacheKey, fetchWatchlistRows, mergeSignalsIntoRows]);

  const applyOptimisticMutation = useCallback((mutation = {}) => {
    const removed = new Set(
      (Array.isArray(mutation.removed) ? mutation.removed : [])
        .map(s => normalizeWatchlistSymbol(s))
        .filter(Boolean),
    );
    const added = (Array.isArray(mutation.added) ? mutation.added : [])
      .map(s => normalizeWatchlistSymbol(s))
      .filter(Boolean);
    if (!removed.size && !added.length) return;
    setRows(prev => {
      let next = prev.filter(r => !removed.has(normalizeWatchlistSymbol(r?.symbol)));
      const existing = new Set(next.map(r => normalizeWatchlistSymbol(r?.symbol)));
      for (const sym of added) {
        if (!existing.has(sym)) {
          next = [...next, {symbol: sym}];
          existing.add(sym);
        }
      }
      return next;
    });
  }, []);

  const reloadWatchlist = useCallback(async (options = {}) => {
    const forceRefresh = options?.forceRefresh === true;
    const gen = ++loadGenRef.current;
    if (forceRefresh) {
      await clearPageCache(cacheKey);
      applyOptimisticMutation(options?.optimistic);
    }
    try {
      const wl = await fetchWatchlistRows({cacheBust: forceRefresh});
      if (gen !== loadGenRef.current) return [];
      const baseRows = Array.isArray(wl) ? wl : [];
      setRows(baseRows);
      await writePageCache(cacheKey, baseRows);
      await mergeSignalsIntoRows(baseRows, undefined, gen);
      return baseRows;
    } catch (e) {
      if (gen === loadGenRef.current) {
        setLoadError(e?.message || 'Failed to reload watchlist.');
      }
      return [];
    }
  }, [applyOptimisticMutation, cacheKey, fetchWatchlistRows, mergeSignalsIntoRows]);

  const sortedRows = useMemo(
    () => sortRows(rows, sortConfig, (row, key) => getWatchlistSortValue(row, key, horizon)),
    [horizon, rows, sortConfig],
  );

  const mergedSymbolOptions = useMemo(
    () => mergeSymbolOptions(symbolOptions, rows.map(r => r?.symbol).filter(Boolean)),
    [rows, symbolOptions],
  );

  const existingSymbols = useMemo(
    () => new Set(rows.map(r => normalizeWatchlistSymbol(r?.symbol)).filter(Boolean)),
    [rows],
  );

  const addSymbolOptions = useMemo(
    () => mergedSymbolOptions.filter(opt => !existingSymbols.has(normalizeWatchlistSymbol(opt?.symbol))),
    [existingSymbols, mergedSymbolOptions],
  );

  const handleAddToWatchlist = useCallback(async () => {
    const symbol = normalizeWatchlistSymbol(addSym);
    if (!symbol) {
      setActionMsg('Select or type a symbol to add.');
      return;
    }
    if (existingSymbols.has(symbol)) {
      setActionMsg(`${symbol} is already on this watchlist.`);
      return;
    }
    setAdding(true);
    setActionMsg('');
    setLoadError('');
    try {
      await watchlistService.addToWatchlist(symbol, horizon);
      setAddSym('');
      setSym(symbol);
      await reloadWatchlist({
        forceRefresh: true,
        optimistic: {added: [symbol]},
      });
      setActionMsg(`Added ${symbol} to ${horizon === 'short_term' ? 'Short Term' : 'Long Term'} watchlist.`);
    } catch (e) {
      setActionMsg(e?.message || 'Failed to add symbol.');
    } finally {
      setAdding(false);
    }
  }, [addSym, existingSymbols, horizon, reloadWatchlist]);

  const confirmRemoveFromWatchlist = useCallback(
    symbol => {
      const target = normalizeWatchlistSymbol(symbol);
      if (!target) return;
      Alert.alert(
        'Remove from watchlist',
        `Remove ${target} from ${horizon === 'short_term' ? 'Short Term' : 'Long Term'}?`,
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              setRemovingSym(target);
              setActionMsg('');
              setLoadError('');
              try {
                await watchlistService.removeFromWatchlist(target, horizon);
                if (normalizeWatchlistSymbol(sym) === target) setSym('');
                await reloadWatchlist({
                  forceRefresh: true,
                  optimistic: {removed: [target]},
                });
                setActionMsg(`Removed ${target} from watchlist.`);
              } catch (e) {
                setActionMsg(e?.message || 'Failed to remove symbol.');
              } finally {
                setRemovingSym('');
              }
            },
          },
        ],
      );
    },
    [horizon, reloadWatchlist, sym],
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
        <Text style={styles.panelTitle}>
          Add to {horizon === 'short_term' ? 'Short Term' : 'Long Term'} watchlist
        </Text>
        <Text style={styles.panelHint}>Search NSE symbols and tap Add — same lists as the web dashboard.</Text>
        <SymbolAutocomplete
          value={addSym}
          onChange={setAddSym}
          options={addSymbolOptions}
          placeholder="Search symbol to add…"
        />
        <Pressable
          style={[styles.addBtn, adding ? styles.addBtnDisabled : null]}
          onPress={handleAddToWatchlist}
          disabled={adding}>
          {adding ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.addBtnTxt}>Add stock</Text>
          )}
        </Pressable>
        {actionMsg ? <Text style={styles.actionMsg}>{actionMsg}</Text> : null}
      </View>

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
              <Text style={[styles.th, {flex: 0.45}]}> </Text>
            </View>
          }
          renderItem={({item, index}) => {
            const pct = stockRowPct(item);
            const pc = pct == null ? AYC.textMuted : pct >= 0 ? AYC.positive : AYC.negative;
            const rs = ratingBadgeStyle(item.recommendation);
            const rowSym = normalizeWatchlistSymbol(item.symbol);
            const selected = rowSym === normalizeWatchlistSymbol(sym);
            const isRemoving = removingSym === rowSym;
            return (
              <Pressable
                style={[styles.tr, index % 2 === 0 ? styles.trAlt : null, selected ? styles.trSelected : null]}
                onPress={() => setSym(rowSym)}
                onLongPress={() => confirmRemoveFromWatchlist(rowSym)}>
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
                <Pressable
                  style={styles.removeBtn}
                  onPress={() => confirmRemoveFromWatchlist(rowSym)}
                  disabled={isRemoving}
                  hitSlop={8}>
                  {isRemoving ? (
                    <ActivityIndicator color={AYC.negative} size="small" />
                  ) : (
                    <Text style={styles.removeTxt}>×</Text>
                  )}
                </Pressable>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.empty}>
              No stocks on this watchlist yet. Use Add stock above to track symbols on mobile.
            </Text>
          }
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
  panelHint: {fontSize: AYC.type.caption, color: AYC.textMuted, lineHeight: 18},
  addBtn: {
    backgroundColor: AYC.accent,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  addBtnDisabled: {opacity: 0.7},
  addBtnTxt: {color: '#fff', fontWeight: '800', fontSize: AYC.type.metricMd},
  actionMsg: {fontSize: AYC.type.caption, color: AYC.accent, fontWeight: '700'},
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
  removeBtn: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeTxt: {
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '700',
    color: AYC.negative,
  },
  empty: {padding: 24, textAlign: 'center', color: AYC.textMuted, fontSize: AYC.type.body},
  loadErr: {marginTop: 8, fontSize: AYC.type.caption, color: AYC.negative, fontWeight: '700'},
});
