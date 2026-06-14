import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {MobileChrome} from '@components/mobileChrome/MobileChrome';
import {FiiDiiCashCards} from '@components/FiiDiiCashCards';
import {MarketIndexCardsRow} from '@components/MarketIndexCardsRow';
import {SortableTableHeader} from '@components/SortableTableHeader';
import {dashboardService} from '@core/api/services/dashboardService';
import {MIN_FII_DII_DAYS} from '@core/utils/fiiDiiPayload';
import {pctColor, subsectorRowBg} from '@core/utils/outlookPayload';
import {sortRows} from '@core/utils/tableSort';
import {getMarketIndexSortValue, getSectorSortValue, getSubsectorSortValue} from '@core/utils/screenSortValues';
import {useTableSort} from '@hooks/useTableSort';
import {AYC} from '@core/theme/aycMobileTheme';
import {navigateToMainTab} from '@nav/navigationHelpers';

const TABS = [
  {id: 'market', label: 'Market Insights'},
  {id: 'sector', label: 'Sector Insights'},
  {id: 'subsector', label: 'SubSector'},
];

export function MarketsHomeScreen({navigation}) {
  const [tab, setTab] = useState('market');
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState([]);
  const [sectorRows, setSectorRows] = useState([]);
  const [subRows, setSubRows] = useState([]);
  const [fii, setFii] = useState(null);
  const [error, setError] = useState('');
  const {sortConfig, onSort, resetSort} = useTableSort();

  const load = useCallback(async () => {
    setError('');
    try {
      if (tab === 'market') {
        const [market, fd] = await Promise.all([
          dashboardService.fetchMarketIndices(),
          dashboardService.fetchFiiDii({days: MIN_FII_DII_DAYS}).catch(() => null),
        ]);
        setRows(Array.isArray(market) ? market : []);
        setFii(fd);
      } else if (tab === 'sector') {
        const data = await dashboardService.fetchSectorOutlook();
        setSectorRows(Array.isArray(data) ? data : []);
      } else {
        const data = await dashboardService.fetchSubsectorOutlook();
        setSubRows(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setBusy(false);
      setRefreshing(false);
    }
  }, [tab]);

  useFocusEffect(
    useCallback(() => {
      setBusy(true);
      load();
    }, [load]),
  );

  useEffect(() => {
    resetSort();
  }, [tab, resetSort]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setBusy(true);
    load();
  }, [load]);

  const list = tab === 'market' ? rows : tab === 'sector' ? sectorRows : subRows;
  const sortFn =
    tab === 'sector' ? getSectorSortValue : tab === 'subsector' ? getSubsectorSortValue : getMarketIndexSortValue;
  const tableRows = useMemo(() => {
    const sorted = sortRows(list, sortConfig, sortFn);
    return tab === 'subsector' ? sorted : sorted.slice(0, 12);
  }, [list, sortConfig, sortFn, tab]);

  const tableHeaders =
    tab === 'sector'
      ? [
          {label: 'Index', key: 'name', flex: 1.2},
          {label: 'Trend', key: 'trend', flex: 0.55, sortable: false},
          {label: '1D', key: 'day1d', flex: 0.7},
          {label: '1W', key: 'week1w', flex: 0.7},
          {label: '1M', key: 'month1m', flex: 0.7},
        ]
      : [
          {label: 'Index', key: 'name', flex: 1.2},
          {label: 'Trend', key: 'trend', flex: 0.7, sortable: false},
          {label: '1D', key: 'day1d', flex: 0.7},
          {label: '1W', key: 'week1w', flex: 0.7},
          {label: '1M', key: 'month1m', flex: 0.7},
        ];

  return (
    <MobileChrome navigation={navigation}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.pad} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={styles.headRow}>
          <Text style={styles.pageTitle}>Overview</Text>
          <Pressable onPress={() => navigateToMainTab(navigation, 'Dashboard')}>
            <Text style={styles.miniLink}>Dashboard</Text>
          </Pressable>
        </View>

        <View style={styles.tabRow}>
          {TABS.map(t => (
            <Pressable key={t.id} onPress={() => setTab(t.id)} style={[styles.tabChip, tab === t.id && styles.tabOn]}>
              <Text style={[styles.tabText, tab === t.id && styles.tabTextOn]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        {busy ? <ActivityIndicator color={AYC.accent} /> : null}
        {error ? <Text style={styles.err}>{error}</Text> : null}

        {tab === 'market' ? (
          <>
            <MarketIndexCardsRow items={rows} showTrend />

            <FiiDiiCashCards data={fii} loading={busy && !fii} />
          </>
        ) : null}

        <Text style={styles.sectionTitle}>
          {tab === 'sector' ? 'SECTOR INDICES' : tab === 'subsector' ? 'SUBSECTOR OUTLOOK' : 'MARKET INDICES TABLE'}
        </Text>

        {tab !== 'subsector' ? (
          <>
            <View style={styles.tableHead}>
              {tableHeaders.map(h => (
                <SortableTableHeader
                  key={h.key}
                  label={h.label}
                  sortKey={h.key}
                  sortConfig={sortConfig}
                  onSort={onSort}
                  style={{flex: h.flex}}
                  textStyle={styles.h}
                  sortable={h.sortable !== false}
                />
              ))}
            </View>
            {tableRows.map((item, idx) => {
              const d1Color = pctColor(item?.day1d, {positive: AYC.positive, negative: AYC.negative, neutral: AYC.text});
              const w1Color = pctColor(item?.week1w, {positive: AYC.positive, negative: AYC.negative, neutral: AYC.text});
              const m1Color = pctColor(item?.month1m, {positive: AYC.positive, negative: AYC.negative, neutral: AYC.text});
              const trendColor =
                item?.trendDirection === 'up'
                  ? AYC.positive
                  : item?.trendDirection === 'down'
                    ? AYC.negative
                    : AYC.textMuted;
              const trendText =
                tab === 'sector' ? item?.trend || '→' : String(item?.trend || 'SIDEWAYS').replace(' TREND', '');
              return (
                <View key={`row-${idx}`} style={styles.tableRow}>
                  <Text style={[styles.c, {flex: 1.2}]} numberOfLines={1}>{item?.name || '--'}</Text>
                  <Text style={[styles.c, {flex: tab === 'sector' ? 0.55 : 0.7, color: trendColor, fontWeight: '800'}]}>
                    {trendText}
                  </Text>
                  <Text style={[styles.c, {flex: 0.7, color: d1Color}]}>{item?.day1d ?? '—'}</Text>
                  <Text style={[styles.c, {flex: 0.7, color: w1Color}]}>{item?.week1w ?? '—'}</Text>
                  <Text style={[styles.c, {flex: 0.7, color: m1Color}]}>{item?.month1m ?? '—'}</Text>
                </View>
              );
            })}
          </>
        ) : (
          <>
            <View style={styles.tableHead}>
              <SortableTableHeader label="Sub Sector" sortKey="name" sortConfig={sortConfig} onSort={onSort} style={{flex: 1.2}} textStyle={styles.h} />
              <SortableTableHeader label="ALL" sortKey="performance" sortConfig={sortConfig} onSort={onSort} style={{flex: 0.55}} textStyle={styles.h} />
              <SortableTableHeader label="W1" sortKey="week0" sortConfig={sortConfig} onSort={onSort} style={{flex: 0.5}} textStyle={styles.h} />
              <SortableTableHeader label="W2" sortKey="week1" sortConfig={sortConfig} onSort={onSort} style={{flex: 0.5}} textStyle={styles.h} />
            </View>
            {tableRows.length === 0 && !busy ? (
              <Text style={styles.empty}>No subsector data available.</Text>
            ) : null}
            {tableRows.map((item, idx) => {
              const showSectorHeader = item.sector && (idx === 0 || tableRows[idx - 1]?.sector !== item.sector);
              const perfColor = pctColor(item?.performance, {
                positive: AYC.positive,
                negative: AYC.negative,
                neutral: AYC.text,
              });
              const w0Color = pctColor(item?.week0, {positive: AYC.positive, negative: AYC.negative, neutral: AYC.text});
              const w1Color = pctColor(item?.week1, {positive: AYC.positive, negative: AYC.negative, neutral: AYC.text});
              return (
                <React.Fragment key={`sub-${item.sector}-${item.name}-${idx}`}>
                  {showSectorHeader ? (
                    <View style={styles.sectorHeader}>
                      <Text style={styles.sectorHeaderText}>{item.sector}</Text>
                    </View>
                  ) : null}
                  <View style={[styles.tableRow, {backgroundColor: subsectorRowBg(item?.trend_pct)}]}>
                    <Text style={[styles.c, {flex: 1.2}]} numberOfLines={2}>
                      {item.name}
                    </Text>
                    <Text style={[styles.c, {flex: 0.55, color: perfColor, fontWeight: '800'}]}>{item.performance}</Text>
                    <Text style={[styles.c, {flex: 0.5, color: w0Color}]}>{item.week0}</Text>
                    <Text style={[styles.c, {flex: 0.5, color: w1Color}]}>{item.week1}</Text>
                  </View>
                </React.Fragment>
              );
            })}
          </>
        )}
      </ScrollView>
    </MobileChrome>
  );
}

const styles = StyleSheet.create({
  scroll: {flex: 1},
  pad: {padding: 12, paddingBottom: 24, gap: 10},
  headRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  pageTitle: {fontSize: AYC.type.pageTitle, fontWeight: '800', color: AYC.text},
  miniLink: {fontSize: AYC.type.caption, fontWeight: '700', color: AYC.accent},
  tabRow: {flexDirection: 'row', gap: 6},
  tabChip: {paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#fff'},
  tabOn: {backgroundColor: AYC.appBar, borderColor: AYC.appBar},
  tabText: {fontSize: AYC.type.caption, fontWeight: '700', color: AYC.textMuted},
  tabTextOn: {color: '#fff'},
  err: {fontSize: AYC.type.caption, color: AYC.negative},
  infoCard: {borderWidth: 1, borderColor: AYC.cardBorder, borderRadius: 10, backgroundColor: '#fff', padding: 10, gap: 6},
  infoTitle: {fontSize: AYC.type.cardLabel, color: AYC.textMuted, fontWeight: '700'},
  sectionTitle: {fontSize: AYC.type.sectionTitle, fontWeight: '800', color: AYC.textMuted, letterSpacing: 0.6},
  tableHead: {flexDirection: 'row', backgroundColor: AYC.appBar, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 6},
  h: {color: '#fff', fontSize: AYC.type.cardLabel, fontWeight: '800'},
  tableRow: {flexDirection: 'row', paddingVertical: 7, paddingHorizontal: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: AYC.cardBorder, backgroundColor: '#fff'},
  c: {fontSize: AYC.type.caption, color: AYC.text, fontWeight: '700'},
  sectorHeader: {
    backgroundColor: '#eff6ff',
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginTop: 6,
    borderRadius: 6,
  },
  sectorHeaderText: {fontSize: AYC.type.caption, fontWeight: '800', color: AYC.accent},
  empty: {paddingVertical: 16, textAlign: 'center', color: AYC.textMuted, fontSize: AYC.type.body},
});
