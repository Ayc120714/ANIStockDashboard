import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {AYC} from '@core/theme/aycMobileTheme';
import {FiiDiiCashCards} from '@components/FiiDiiCashCards';
import {ListPagePager} from '@components/ListPagePager';
import {SortableTableHeader} from '@components/SortableTableHeader';
import {SubsectorStocksModal} from '@components/SubsectorStocksModal';
import {TradingViewLink} from '@components/TradingViewLink';
import {MIN_FII_DII_DAYS} from '@core/utils/fiiDiiPayload';
import {dashboardService} from '@core/api/services/dashboardService';
import {deriveSubsectorPerformers, formatSubsectorAll, pctColor, subsectorRowBg} from '@core/utils/outlookPayload';
import {sortRows} from '@core/utils/tableSort';
import {getSectorSortValue, getSubsectorSortValue} from '@core/utils/screenSortValues';
import {useTableSort} from '@hooks/useTableSort';
import {isStockEmbeddedTabId, isStockOutlookTab, isStockTabId, isWatchlistTabId} from '@nav/navigationHelpers';
import {WatchlistSection} from './WatchlistSection';
import {OrdersScreen} from '@features/orders/OrdersScreen';
import {BrokersScreen} from '@features/brokers/BrokersScreen';
import {API_TIMEOUT_MS} from '@core/config/apiTimeouts';
import {MOBILE_PAGE_CACHE_KEYS} from '@core/utils/dashboardCachePolicy';
import {useFocusEffect} from '@react-navigation/native';
import {
  ensureMarketSession,
  getCachedMarketSession,
  getMarketPollingIntervalMs,
  shouldPollLiveMarket,
} from '@core/utils/marketSession';
import {hydrateFromPageCache} from '@core/utils/pageCacheHydration';
import {runScreenPayloadFetch, shouldRefreshPageCache} from '@core/utils/screenPageLoader';
import {normalizeMarketIndicesCards} from '@core/utils/marketIndicesCards';
import {resolveSectorSubsectorMapping} from '@core/utils/sectorSubsectorMap';
import {getTradingViewChartSymbol} from '@core/utils/tradingViewOutlookSymbols';

const OUTLOOK_LIVE_POLL_MS = 30_000;

const OUTLOOK_TABS = [
  {id: 'market', label: 'Market'},
  {id: 'sector', label: 'Sector'},
  {id: 'sub', label: 'SubSector'},
  {id: 'long_term', label: 'LT'},
  {id: 'short_term', label: 'ST'},
  {id: 'orders', label: 'Orders'},
  {id: 'brokers', label: 'Brokers'},
];

const SUB_STRENGTH = [
  {id: 'all', label: 'All'},
  {id: 'strong', label: 'Strong'},
  {id: 'mod', label: 'Moderate'},
  {id: 'weak', label: 'Weak'},
];

const toList = raw => {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') return Object.values(raw);
  return [];
};

function matchesSearch(row, q) {
  if (!q.trim()) return true;
  const s = q.trim().toLowerCase();
  const name = String(row?.name || row?.symbol || '').toLowerCase();
  return name.includes(s);
}

function outlookHasUsable(tab, data) {
  if (!data) return false;
  if (tab === 'market') return data?.indices?.length > 0 || data?.fii != null;
  if (tab === 'sector') return data?.sectorRows?.length > 0;
  return Array.isArray(data?.grouped?.data) && data.grouped.data.length > 0;
}

export function StocksOverviewSection({navigation, initialTab, ordersParams, brokersParams}) {
  const [tab, setTab] = useState(() => (isStockTabId(initialTab) ? initialTab : 'market'));
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [indices, setIndices] = useState([]);
  const [sectorRows, setSectorRows] = useState([]);
  const [fii, setFii] = useState(null);
  const [grouped, setGrouped] = useState(null);
  const [subStrength, setSubStrength] = useState('all');
  const [selectedSector, setSelectedSector] = useState(null);
  const [mappedGroups, setMappedGroups] = useState(null);
  const [stocksModal, setStocksModal] = useState({visible: false, subsector: '', sector: ''});
  const [err, setErr] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const initialLoadDone = useRef(false);
  const outlookSortKey = tab === 'sub' ? 'all' : tab === 'sector' ? 'day1d' : null;
  const {sortConfig, onSort, resetSort} = useTableSort(outlookSortKey, false);

  const pageSize = 5;

  const load = useCallback(async ({forceRefresh = false, silent = false} = {}) => {
    if (!isStockOutlookTab(tab)) return;
    const cacheKey = MOBILE_PAGE_CACHE_KEYS.stocksOutlook(tab);
    await runScreenPayloadFetch({
      cacheKey,
      fetcher: async () => {
        if (tab === 'market') {
          const [ixRaw, fd] = await Promise.all([
            dashboardService.fetchMarketIndicesRaw(),
            dashboardService.fetchFiiDii({days: MIN_FII_DII_DAYS}).catch(() => null),
          ]);
          const indices = normalizeMarketIndicesCards(ixRaw);
          return {indices: indices.length ? indices : toList(ixRaw), fii: fd, sectorRows: [], grouped: null};
        }
        if (tab === 'sector') {
          const data = await dashboardService.fetchSectorOutlook();
          return {indices: [], fii: null, sectorRows: toList(data), grouped: null};
        }
        const grouped = await dashboardService.fetchSubsectorOutlookGrouped({
          timeoutMs: API_TIMEOUT_MS.screenHeavy,
        });
        return {indices: [], fii: null, sectorRows: [], grouped};
      },
      applyPayload: payload => {
        setIndices(payload.indices || []);
        setFii(payload.fii ?? null);
        setSectorRows(payload.sectorRows || []);
        setGrouped(payload.grouped ?? null);
      },
      setLoading: v => setBusy(v),
      setError: msg => setErr(msg || ''),
      forceNetwork: forceRefresh,
      hasUsable: data => outlookHasUsable(tab, data),
      silent: silent && !forceRefresh,
    });
  }, [tab]);

  useEffect(() => {
    if (!isStockOutlookTab(tab)) return undefined;
    let cancelled = false;
    initialLoadDone.current = false;
    (async () => {
      const cacheKey = MOBILE_PAGE_CACHE_KEYS.stocksOutlook(tab);
      const hadCache = await hydrateFromPageCache(cacheKey, {
        apply: payload => {
          setIndices(payload.indices || []);
          setFii(payload.fii ?? null);
          setSectorRows(payload.sectorRows || []);
          setGrouped(payload.grouped ?? null);
        },
        hasUsable: data => outlookHasUsable(tab, data),
      });
      if (cancelled) return;
      await load({silent: hadCache});
      initialLoadDone.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [load, tab]);

  const selectTab = useCallback(
    nextTab => {
      if (nextTab === tab) return;
      setErr('');
      setTab(nextTab);
      setPage(1);
      resetSort();
      if (nextTab !== 'sub') {
        setSelectedSector(null);
        setMappedGroups(null);
      }
    },
    [resetSort, tab],
  );

  const handleSectorClick = useCallback(
    sectorName => {
      const mapped = resolveSectorSubsectorMapping(sectorName);
      setSelectedSector(sectorName);
      setMappedGroups(Array.isArray(mapped) && mapped.length ? mapped : null);
      setTab('sub');
      setPage(1);
      resetSort();
    },
    [resetSort],
  );

  const clearSectorFilter = useCallback(() => {
    setSelectedSector(null);
    setMappedGroups(null);
  }, []);

  const openSubsectorStocks = useCallback((subsectorName, sectorName) => {
    setStocksModal({visible: true, subsector: subsectorName, sector: sectorName || ''});
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load({forceRefresh: true});
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (!isStockOutlookTab(tab) || !initialLoadDone.current) return undefined;
      (async () => {
        const cacheKey = MOBILE_PAGE_CACHE_KEYS.stocksOutlook(tab);
        const stale = await shouldRefreshPageCache(cacheKey);
        if (stale) {
          await load({silent: indices.length > 0 || sectorRows.length > 0 || grouped != null});
        }
      })();
      return undefined;
    }, [grouped, indices.length, load, sectorRows.length, tab]),
  );

  useEffect(() => {
    if (!isStockOutlookTab(tab)) return undefined;
    let pollId;
    (async () => {
      await ensureMarketSession();
      const pollMs = getMarketPollingIntervalMs(OUTLOOK_LIVE_POLL_MS, 0);
      if (pollMs <= 0) return;
      pollId = setInterval(async () => {
        await ensureMarketSession();
        if (!shouldPollLiveMarket(getCachedMarketSession())) return;
        await load({silent: true, forceRefresh: true});
      }, pollMs);
    })();
    return () => {
      if (pollId) clearInterval(pollId);
    };
  }, [load, tab]);

  useEffect(() => {
    if (isStockTabId(initialTab)) {
      setTab(initialTab);
      setPage(1);
    }
  }, [initialTab]);

  useEffect(() => {
    resetSort();
    setPage(1);
  }, [tab, resetSort]);

  const filteredSector = useMemo(() => {
    return sectorRows.filter(r => matchesSearch(r, search));
  }, [sectorRows, search]);

  const sortedSector = useMemo(
    () => sortRows(filteredSector, sortConfig, getSectorSortValue),
    [filteredSector, sortConfig],
  );

  const pagedSector = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedSector.slice(start, start + pageSize);
  }, [page, pageSize, sortedSector]);

  const totalPages = Math.max(1, Math.ceil(sortedSector.length / pageSize));

  const subDerived = useMemo(
    () => deriveSubsectorPerformers(grouped, {search, subStrength, mappedGroups}),
    [grouped, mappedGroups, search, subStrength],
  );

  const subWeekLabels = subDerived.weekLabels;
  const subRowsFlat = subDerived.rows;

  const sortedSubRows = useMemo(
    () => sortRows(subRowsFlat, sortConfig, getSubsectorSortValue),
    [subRowsFlat, sortConfig],
  );

  const pagedSubRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedSubRows.slice(start, start + pageSize);
  }, [page, pageSize, sortedSubRows]);

  const subTotalPages = Math.max(1, Math.ceil(sortedSubRows.length / pageSize));

  const renderMarket = () => (
    <View>
      <FiiDiiCashCards data={fii} loading={busy && !fii} />
      <FlatList
        scrollEnabled={false}
        data={indices.filter(r => matchesSearch({name: r?.name || r?.symbol}, search))}
        keyExtractor={(it, i) => String(it?.name || it?.symbol || i)}
        renderItem={({item}) => {
          const name = item?.name || item?.symbol || '—';
          const ltp = item?.value ?? item?.ltp ?? item?.last;
          const chDisplay = item?.day1d ?? '—';
          const col = pctColor(chDisplay, {positive: AYC.positive, negative: AYC.negative, neutral: AYC.text});
          return (
            <View style={styles.dataCard}>
              <View style={styles.symRow}>
                <TradingViewLink chartSymbol={getTradingViewChartSymbol(name)} size={16} />
                <Text style={styles.sym}>{name}</Text>
              </View>
              <Text style={styles.cmp} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                {typeof ltp === 'number' ? ltp.toLocaleString('en-IN', {maximumFractionDigits: 2}) : ltp ?? '—'}
              </Text>
              <Text style={{color: col, fontWeight: '800'}}>{chDisplay}</Text>
              <Text style={styles.trendTag}>{item?.trend || '—'}</Text>
            </View>
          );
        }}
      />
    </View>
  );

  const renderSector = () => (
    <View>
      <View style={styles.tableHead}>
        <Text style={[styles.th, {width: 28}]}>#</Text>
        <Text style={[styles.th, {width: 22}]} />
        <SortableTableHeader label="Index" sortKey="name" sortConfig={sortConfig} onSort={onSort} style={{flex: 1.2}} />
        <SortableTableHeader label="Trend" sortKey="trend" sortConfig={sortConfig} onSort={onSort} style={{width: 36}} />
        <SortableTableHeader label="1D" sortKey="day1d" sortConfig={sortConfig} onSort={onSort} style={{flex: 0.7}} />
        <SortableTableHeader label="1W" sortKey="week1w" sortConfig={sortConfig} onSort={onSort} style={{flex: 0.7}} />
        <SortableTableHeader label="1M" sortKey="month1m" sortConfig={sortConfig} onSort={onSort} style={{flex: 0.7}} />
      </View>
      {pagedSector.map((item, idx) => {
        const i = (page - 1) * pageSize + idx + 1;
        const d1Color = pctColor(item.day1d, {positive: AYC.positive, negative: AYC.negative, neutral: AYC.text});
        const w1Color = pctColor(item.week1w, {positive: AYC.positive, negative: AYC.negative, neutral: AYC.text});
        const m1Color = pctColor(item.month1m, {positive: AYC.positive, negative: AYC.negative, neutral: AYC.text});
        const trendColor =
          item.trendDirection === 'up'
            ? AYC.positive
            : item.trendDirection === 'down'
              ? AYC.negative
              : AYC.textMuted;
        return (
          <View key={String(item.id || item.name || idx)} style={styles.tableRow}>
            <Text style={[styles.td, {width: 28}]}>{i}</Text>
            <View style={{width: 22}}>
              <TradingViewLink chartSymbol={getTradingViewChartSymbol(item.name)} size={16} />
            </View>
            <Pressable style={{flex: 1.2}} onPress={() => handleSectorClick(item.name)}>
              <Text style={[styles.td, {color: AYC.accent, fontWeight: '800', textDecorationLine: 'underline'}]} numberOfLines={1}>
                {item.name}
              </Text>
            </Pressable>
            <Text style={[styles.td, {width: 36, color: trendColor, fontWeight: '800'}]}>{item.trend || '→'}</Text>
            <Text style={[styles.td, {flex: 0.7, color: d1Color, fontWeight: '700'}]} numberOfLines={1}>
              {item.day1d ?? '—'}
            </Text>
            <Text style={[styles.td, {flex: 0.7, color: w1Color, fontWeight: '700'}]} numberOfLines={1}>
              {item.week1w ?? '—'}
            </Text>
            <Text style={[styles.td, {flex: 0.7, color: m1Color, fontWeight: '700'}]} numberOfLines={1}>
              {item.month1m ?? '—'}
            </Text>
          </View>
        );
      })}
      <ListPagePager
        page={page}
        totalPages={totalPages}
        totalItems={sortedSector.length}
        onPageChange={setPage}
      />
    </View>
  );

  const renderSub = () => {
    const top = subDerived.topPerformers;
    const under = subDerived.underPerformers;
  const weekCols = subWeekLabels.length ? subWeekLabels : ['W1', 'W2', 'W3'];

    return (
      <View>
        {selectedSector && mappedGroups ? (
          <View style={styles.sectorBanner}>
            <Text style={styles.sectorBannerTxt}>
              Subsectors for {selectedSector} ({mappedGroups.length} mapped)
            </Text>
            <Pressable onPress={clearSectorFilter} style={styles.sectorBannerBtn}>
              <Text style={styles.sectorBannerBtnTxt}>Show all</Text>
            </Pressable>
          </View>
        ) : null}
        <Text style={styles.subHint}>Tap a subsector to view constituent stocks</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {SUB_STRENGTH.map(c => (
            <Pressable
              key={c.id}
              onPress={() => setSubStrength(c.id)}
              style={[styles.chip, subStrength === c.id ? styles.chipOn : null]}
            >
              <Text style={[styles.chipTxt, subStrength === c.id ? styles.chipTxtOn : null]}>{c.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.legend}>
          <Text style={styles.legRed}>Weak &lt; -2%</Text>
          <Text style={styles.legAmb}>Moderate</Text>
          <Text style={styles.legGr}>Strong &gt; +2%</Text>
        </View>
        {top.length ? (
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Top performers</Text>
            {top.map(t => (
              <View key={t.subsector} style={styles.tpRow}>
                <Text style={styles.tpName}>{t.subsector}</Text>
                <Text style={styles.tpPct}>{t.performance}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {under.length ? (
          <View style={styles.block}>
            <Text style={[styles.blockTitle, styles.blockTitleUnder]}>Under performers</Text>
            {under.map(t => (
              <View key={`under-${t.subsector}`} style={styles.tpRow}>
                <Text style={styles.tpName}>{t.subsector}</Text>
                <Text style={styles.tpPctUnder}>{t.performance}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <View style={styles.tableHead}>
          <SortableTableHeader label="Sub Sector" sortKey="name" sortConfig={sortConfig} onSort={onSort} style={{flex: 1.2}} textStyle={styles.th} />
          <SortableTableHeader label="ALL" sortKey="all" sortConfig={sortConfig} onSort={onSort} style={{flex: 0.5}} textStyle={styles.th} />
          {weekCols.map(lbl => (
            <SortableTableHeader
              key={lbl}
              label={lbl}
              sortKey={lbl}
              sortConfig={sortConfig}
              onSort={onSort}
              style={{flex: 0.45}}
              textStyle={styles.th}
            />
          ))}
        </View>
        {sortedSubRows.length === 0 ? (
          <Text style={styles.emptySub}>No subsector data available.</Text>
        ) : null}
        {pagedSubRows.map((item, idx) => {
          const globalIdx = (page - 1) * pageSize + idx;
          const {sub: row, sector, weekLabels: labels} = item;
          const showSectorHeader = sector && (globalIdx === 0 || sortedSubRows[globalIdx - 1]?.sector !== sector);
          const p = row.trend_pct;
          const bg = subsectorRowBg(p);
          const allDisplay = formatSubsectorAll(row.all);
          const allColor = pctColor(allDisplay, {positive: AYC.positive, negative: AYC.negative, neutral: AYC.text});
          return (
            <React.Fragment key={`${sector}-${row.name}-${idx}`}>
              {showSectorHeader ? <Text style={styles.secHead}>{sector}</Text> : null}
              <Pressable
                style={[styles.subRow, {backgroundColor: bg}]}
                onPress={() => openSubsectorStocks(row.name, sector)}>
                <Text style={[styles.subName, {flex: 1.2, color: AYC.accent, textDecorationLine: 'underline'}]} numberOfLines={2}>
                  {row.name}
                </Text>
                <Text style={[styles.subCell, {flex: 0.5, color: allColor}]}>{allDisplay}</Text>
                {weekCols.map(lbl => {
                  const val = labels.includes(lbl) ? row[lbl] : null;
                  const display = val != null && val !== '' ? `${val}%` : '—';
                  const col = pctColor(display, {positive: AYC.positive, negative: AYC.negative, neutral: AYC.text});
                  return (
                    <Text key={`${row.name}-${lbl}`} style={[styles.subCell, {flex: 0.45, color: col}]}>
                      {display}
                    </Text>
                  );
                })}
              </Pressable>
            </React.Fragment>
          );
        })}
        <ListPagePager
          page={page}
          totalPages={subTotalPages}
          totalItems={sortedSubRows.length}
          onPageChange={setPage}
        />
      </View>
    );
  };

  const tabBar = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}
      style={styles.chipScroll}>
      {OUTLOOK_TABS.map(t => {
        const active = tab === t.id;
        return (
          <Pressable
            key={t.id}
            onPress={() => selectTab(t.id)}
            style={[styles.bigChip, active ? styles.chipOn : null]}>
            <Text style={[styles.bigChipTxt, active ? styles.chipTxtOn : styles.chipTxtOff]} allowFontScaling={false}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  if (isStockEmbeddedTabId(tab)) {
    return (
      <View style={styles.wrapFlex}>
        {!isWatchlistTabId(tab) ? <Text style={styles.ovTitle}>Overview</Text> : null}
        {tabBar}
        {isWatchlistTabId(tab) ? (
          <WatchlistSection navigation={navigation} listType={tab} embedded />
        ) : null}
        {tab === 'orders' ? (
          <OrdersScreen
            navigation={navigation}
            route={{params: ordersParams || {}}}
            embedded
          />
        ) : null}
        {tab === 'brokers' ? (
          <BrokersScreen
            navigation={navigation}
            route={{params: brokersParams || {}}}
            embedded
          />
        ) : null}
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.wrap}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      keyboardShouldPersistTaps="handled">
      <Text style={styles.ovTitle}>Overview</Text>
      {tabBar}
      <TextInput
        style={styles.search}
        placeholder="Search…"
        placeholderTextColor={AYC.textMuted}
        value={search}
        onChangeText={t => { setSearch(t); setPage(1); }}
      />
      {err ? <Text style={styles.err}>{err}</Text> : null}
      {busy && !indices.length && !sectorRows.length && !grouped?.data?.length ? (
        <ActivityIndicator color={AYC.accent} style={{marginVertical: 12}} />
      ) : null}
      {!busy && tab === 'market' ? renderMarket() : null}
      {!busy && tab === 'sector' ? renderSector() : null}
      {!busy && tab === 'sub' ? renderSub() : null}
      <SubsectorStocksModal
        visible={stocksModal.visible}
        subsectorName={stocksModal.subsector}
        sectorName={stocksModal.sector}
        onClose={() => setStocksModal({visible: false, subsector: '', sector: ''})}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: {gap: 8, marginBottom: 16},
  wrapFlex: {flex: 1, gap: 8},
  ovTitle: {fontSize: AYC.type.pageTitle, fontWeight: '800', color: AYC.text},
  chipRow: {flexDirection: 'row', gap: 8, paddingVertical: 4, alignItems: 'center'},
  chipScroll: {flexGrow: 0},
  bigChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: AYC.accent,
    backgroundColor: AYC.card,
    minHeight: 34,
    justifyContent: 'center',
    flexShrink: 0,
  },
  chipOn: {backgroundColor: AYC.appBar, borderColor: AYC.appBar},
  bigChipTxt: {fontSize: 12, fontWeight: '700', lineHeight: 16},
  chipTxtOff: {color: AYC.text},
  chipTxtOn: {color: '#fff'},
  chip: {paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: AYC.cardBorder},
  search: {
    borderWidth: 1,
    borderColor: AYC.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: AYC.text,
    backgroundColor: AYC.card,
  },
  err: {color: AYC.negative, fontSize: 12},
  dataCard: {
    backgroundColor: AYC.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: AYC.cardBorder,
  },
  sym: {fontWeight: '700', fontSize: AYC.type.body, color: AYC.text, flex: 1},
  symRow: {flexDirection: 'row', alignItems: 'center', gap: 6},
  subHint: {fontSize: 11, color: AYC.textMuted, fontWeight: '600', marginBottom: 4},
  sectorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginBottom: 6,
  },
  sectorBannerTxt: {flex: 1, fontSize: 12, fontWeight: '700', color: AYC.text},
  sectorBannerBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: AYC.cardBorder,
  },
  sectorBannerBtnTxt: {fontSize: 11, fontWeight: '800', color: AYC.accent},
  cmp: {fontSize: AYC.type.metricMd, fontWeight: '800', marginTop: 2},
  trendTag: {marginTop: 4, fontSize: 10, fontWeight: '800', color: AYC.textMuted},
  tableHead: {
    flexDirection: 'row',
    backgroundColor: AYC.appBar,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    alignItems: 'center',
  },
  th: {color: '#fff', fontSize: 10, fontWeight: '800'},
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderColor: AYC.cardBorder,
    backgroundColor: AYC.card,
  },
  td: {fontSize: 11, color: AYC.text},
  pager: {flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 10},
  pgBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: AYC.appBar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pgTxt: {color: '#fff', fontSize: 18, fontWeight: '800'},
  pgLbl: {fontWeight: '800', color: AYC.text},
  legend: {flexDirection: 'row', gap: 12, marginVertical: 6, flexWrap: 'wrap'},
  legRed: {fontSize: 11, color: AYC.negative, fontWeight: '700'},
  legAmb: {fontSize: 11, color: AYC.warning, fontWeight: '700'},
  legGr: {fontSize: 11, color: AYC.positive, fontWeight: '700'},
  block: {marginTop: 8, marginBottom: 8},
  blockTitle: {fontSize: 13, fontWeight: '800', color: AYC.textMuted, marginBottom: 6, backgroundColor: '#e2e8f0', padding: 8},
  blockTitleUnder: {color: AYC.negative},
  tpPctUnder: {fontWeight: '800', color: AYC.negative},
  emptySub: {paddingVertical: 12, textAlign: 'center', color: AYC.textMuted, fontSize: 12},
  tpRow: {flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderColor: AYC.cardBorder},
  tpName: {flex: 1, fontWeight: '700', color: AYC.text},
  tpPct: {fontWeight: '800', color: AYC.positive},
  secHead: {fontWeight: '800', fontSize: 13, color: AYC.textMuted, paddingVertical: 8, backgroundColor: '#e2e8f0', paddingHorizontal: 8},
  subRow: {flexDirection: 'row', padding: 8, alignItems: 'center', borderBottomWidth: 1, borderColor: AYC.cardBorder},
  subName: {fontSize: 12, fontWeight: '700', color: AYC.text},
  subCell: {fontSize: 11, fontWeight: '700', textAlign: 'right', color: AYC.text},
});
