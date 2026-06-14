import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {MobileChrome} from '@components/mobileChrome/MobileChrome';
import {SortableTableHeader} from '@components/SortableTableHeader';
import {AYC, mobilePad, mobileStyles} from '@core/theme/mobileStyles';
import {
  flattenTierRows,
  mapFundListRows,
  mutualFundsService,
} from '@core/api/services/mutualFundsService';
import {MOBILE_PAGE_CACHE_KEYS} from '@core/utils/dashboardCachePolicy';
import {runScreenPayloadFetch, runScreenTableFetch} from '@core/utils/screenPageLoader';
import {sortRows} from '@core/utils/tableSort';
import {useTableSort} from '@hooks/useTableSort';

const TABS = [
  {id: 'list', label: 'Fund List'},
  {id: 'tiers', label: 'Enter / Exit'},
  {id: 'rs', label: 'RS D/W/M'},
];

const TIERS = ['B1', 'B2', 'B3', 'S1', 'S2', 'S3'];
const TFS = [
  {id: 'daily', label: 'Daily'},
  {id: 'weekly', label: 'Weekly'},
  {id: 'monthly', label: 'Monthly'},
];

const fmt = (n, dec = 2) =>
  n != null && n !== '' && Number.isFinite(Number(n))
    ? Number(n).toLocaleString('en-IN', {maximumFractionDigits: dec})
    : '—';
const fmtPct = n =>
  n != null && n !== '' && Number.isFinite(Number(n))
    ? `${Number(n) >= 0 ? '+' : ''}${Number(n).toFixed(2)}%`
    : '—';

const tierColor = tier => {
  const map = {B1: '#66bb6a', B2: '#43a047', B3: '#1b5e20', S1: '#ef5350', S2: '#c62828', S3: '#b71c1c'};
  return map[String(tier || '').toUpperCase()] || '#546e7a';
};

function fundSortValue(row, key) {
  if (key === 'scheme_name') return String(row.scheme_name || row.company || '').toLowerCase();
  return row[key];
}

function tierSortValue(row, key) {
  if (key === 'scheme_name') return String(row.scheme_name || '').toLowerCase();
  if (key === 'buy_sell_tier') return String(row.buy_sell_tier || '');
  if (key === 'timeframe') return String(row.timeframe || '');
  return row[key];
}

function rsSortValue(row, key) {
  if (key === 'scheme_name') return String(row.scheme_name || row.symbol || '').toLowerCase();
  return row[key];
}

export function MutualFundsScreen({navigation}) {
  const [tab, setTab] = useState('list');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [meta, setMeta] = useState({});
  const [funds, setFunds] = useState([]);
  const [tierRows, setTierRows] = useState([]);
  const [rsRows, setRsRows] = useState([]);
  const [tf, setTf] = useState('daily');
  const [tier, setTier] = useState('B1');
  const [view, setView] = useState('enter');
  const [setupMode, setSetupMode] = useState('or_signal');
  const {sortConfig, onSort, resetSort} = useTableSort();

  const loadList = useCallback(async ({forceRefresh = false} = {}) => {
    await runScreenPayloadFetch({
      cacheKey: MOBILE_PAGE_CACHE_KEYS.mutualFundsList,
      fetcher: async () => {
        const resp = await mutualFundsService.fetchFunds({refresh: forceRefresh});
        return {funds: mapFundListRows(resp?.funds || []), meta: resp || {}};
      },
      applyPayload: payload => {
        setFunds(payload.funds || []);
        setMeta(payload.meta || {});
      },
      setLoading,
      setError: msg => setError(msg || ''),
      forceNetwork: forceRefresh,
      hasUsable: data => Array.isArray(data?.funds) && data.funds.length > 0,
    });
  }, []);

  const loadTiers = useCallback(async ({forceRefresh = false} = {}) => {
    await runScreenPayloadFetch({
      cacheKey: MOBILE_PAGE_CACHE_KEYS.mutualFundsTiers,
      fetcher: async () => {
        const grid = await mutualFundsService.fetchBuyTierCards({refresh: forceRefresh, fund_limit: 100});
        return {rows: flattenTierRows(grid), grid};
      },
      applyPayload: payload => setTierRows(payload.rows || []),
      setLoading,
      setError: msg => setError(msg || ''),
      forceNetwork: forceRefresh,
      hasUsable: data => Array.isArray(data?.rows) && data.rows.length > 0,
    });
  }, []);

  const loadRs = useCallback(async ({forceRefresh = false} = {}) => {
    await runScreenTableFetch({
      cacheKey: MOBILE_PAGE_CACHE_KEYS.mutualFundsRs(setupMode),
      fetcher: async () => {
        const resp = await mutualFundsService.fetchRsSetup({
          refresh: forceRefresh,
          fund_limit: 100,
          setup_mode: setupMode,
        });
        return Array.isArray(resp?.data) ? resp.data : [];
      },
      setRows: setRsRows,
      setLoading,
      setError: msg => setError(msg || ''),
      forceNetwork: forceRefresh,
    });
  }, [setupMode]);

  useEffect(() => {
    resetSort();
    setError('');
    if (tab === 'list') loadList();
    else if (tab === 'tiers') loadTiers();
    else loadRs();
  }, [loadList, loadRs, loadTiers, resetSort, tab]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (tab === 'list') await loadList({forceRefresh: true});
      else if (tab === 'tiers') await loadTiers({forceRefresh: true});
      else await loadRs({forceRefresh: true});
    } finally {
      setRefreshing(false);
    }
  }, [loadList, loadRs, loadTiers, tab]);

  const sortedFunds = useMemo(
    () => sortRows(funds, sortConfig, fundSortValue),
    [funds, sortConfig],
  );

  const filteredTiers = useMemo(() => {
    const action = view === 'enter' ? 'ENTER' : 'EXIT';
    return tierRows.filter(
      r =>
        String(r.timeframe || '') === tf
        && String(r.buy_sell_tier || '').toUpperCase() === tier
        && String(r.action || '').toUpperCase() === action,
    );
  }, [tier, tierRows, tf, view]);

  const sortedTiers = useMemo(
    () => sortRows(filteredTiers, sortConfig, tierSortValue),
    [filteredTiers, sortConfig],
  );

  const sortedRs = useMemo(
    () => sortRows(rsRows, sortConfig, rsSortValue),
    [rsRows, sortConfig],
  );

  const renderFund = ({item}) => (
    <View style={styles.card}>
      <Text style={styles.sym} numberOfLines={2}>{item.scheme_name || item.company || '—'}</Text>
      <Text style={styles.sub}>{item.category || '—'}</Text>
      <View style={styles.row}>
        <Text style={styles.meta}>NAV {fmt(item.nav)}</Text>
        <Text style={styles.meta}>ER {fmt(item.expense_ratio)}%</Text>
        <Text style={styles.meta}>3Y {fmtPct(item.ret_3y)}</Text>
      </View>
    </View>
  );

  const renderTier = ({item}) => (
    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <Text style={styles.sym} numberOfLines={2}>{item.scheme_name || '—'}</Text>
        <View style={[styles.tierBadge, {backgroundColor: tierColor(item.buy_sell_tier)}]}>
          <Text style={styles.tierBadgeText}>{item.buy_sell_tier}</Text>
        </View>
      </View>
      <Text style={styles.sub}>{item.action} · RS {fmt(item.rs_vs_nifty)} · RSI {fmt(item.rsi)}</Text>
    </View>
  );

  const renderRs = ({item}) => (
    <View style={styles.card}>
      <Text style={styles.sym} numberOfLines={2}>{item.scheme_name || item.symbol || '—'}</Text>
      <Text style={styles.sub}>
        D {fmt(item.rs_daily_123)} · W {fmt(item.rs_weekly_52)} · M {fmt(item.rs_monthly_12)}
      </Text>
    </View>
  );

  const listData = tab === 'list' ? sortedFunds : tab === 'tiers' ? sortedTiers : sortedRs;
  const renderItem = tab === 'list' ? renderFund : tab === 'tiers' ? renderTier : renderRs;

  const header = (
    <View style={{gap: 8}}>
      <View style={styles.titleRow}>
        <Text style={mobileStyles.pageTitle}>Mutual Funds</Text>
        <Pressable style={styles.refreshBtn} onPress={onRefresh}>
          <Text style={styles.refreshTxt}>{refreshing ? '…' : 'Refresh'}</Text>
        </Pressable>
      </View>
      <Text style={mobileStyles.subtitle}>
        Direct MFs
        {meta.updated_date ? ` · ${meta.updated_date}` : ''}
        {meta.count ? ` · ${meta.count} schemes` : ''}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
        {TABS.map(t => (
          <Pressable key={t.id} onPress={() => setTab(t.id)} style={[styles.tab, tab === t.id && styles.tabOn]}>
            <Text style={[styles.tabText, tab === t.id && styles.tabTextOn]}>{t.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {tab === 'tiers' ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {TFS.map(x => (
              <Pressable key={x.id} onPress={() => setTf(x.id)} style={[styles.chip, tf === x.id && styles.chipOn]}>
                <Text style={[styles.chipText, tf === x.id && styles.chipTextOn]}>{x.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {TIERS.map(x => (
              <Pressable key={x} onPress={() => setTier(x)} style={[styles.chip, tier === x && styles.chipOn]}>
                <Text style={[styles.chipText, tier === x && styles.chipTextOn]}>{x}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => setView('enter')} style={[styles.chip, view === 'enter' && styles.chipOn]}>
              <Text style={[styles.chipText, view === 'enter' && styles.chipTextOn]}>Enter</Text>
            </Pressable>
            <Pressable onPress={() => setView('exit')} style={[styles.chip, view === 'exit' && styles.chipOn]}>
              <Text style={[styles.chipText, view === 'exit' && styles.chipTextOn]}>Exit</Text>
            </Pressable>
          </ScrollView>
        </>
      ) : null}
      {tab === 'rs' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {['or_signal', 'strict'].map(mode => (
            <Pressable
              key={mode}
              onPress={() => setSetupMode(mode)}
              style={[styles.chip, setupMode === mode && styles.chipOn]}>
              <Text style={[styles.chipText, setupMode === mode && styles.chipTextOn]}>
                {mode === 'or_signal' ? 'OR signal' : 'Strict cross'}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      {error ? <Text style={styles.err}>{error}</Text> : null}
      {tab === 'list' ? (
        <View style={styles.tableHead}>
          <SortableTableHeader label="Scheme" sortKey="scheme_name" sortConfig={sortConfig} onSort={onSort} style={{flex: 1.4}} textStyle={styles.th} />
          <SortableTableHeader label="3Y" sortKey="ret_3y" sortConfig={sortConfig} onSort={onSort} style={{flex: 0.6}} textStyle={styles.th} />
          <SortableTableHeader label="NAV" sortKey="nav" sortConfig={sortConfig} onSort={onSort} style={{flex: 0.6}} textStyle={styles.th} />
        </View>
      ) : null}
    </View>
  );

  return (
    <MobileChrome navigation={navigation}>
      <FlatList
        data={listData}
        keyExtractor={(item, i) => `${item.scheme_name || item.symbol || 'row'}-${i}`}
        renderItem={renderItem}
        ListHeaderComponent={header}
        contentContainerStyle={mobilePad}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={AYC.accent} style={{marginTop: 24}} />
          ) : (
            <Text style={styles.empty}>No mutual fund data for this view.</Text>
          )
        }
      />
    </MobileChrome>
  );
}

const styles = StyleSheet.create({
  titleRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  refreshBtn: {borderWidth: 1, borderColor: AYC.cardBorder, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: AYC.card},
  refreshTxt: {fontSize: AYC.type.caption, fontWeight: '700', color: AYC.text},
  tabRow: {gap: 8, paddingVertical: 4},
  tab: {paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: 'transparent'},
  tabOn: {borderBottomColor: AYC.accent},
  tabText: {fontSize: AYC.type.body, fontWeight: '600', color: AYC.textMuted},
  tabTextOn: {fontWeight: '800', color: AYC.accent},
  chipRow: {gap: 8, paddingVertical: 2},
  chip: {paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: AYC.cardBorder, backgroundColor: AYC.card},
  chipOn: {backgroundColor: '#dbeafe', borderColor: '#3b82f6'},
  chipText: {fontSize: AYC.type.caption, fontWeight: '700', color: AYC.text},
  chipTextOn: {color: '#1d4ed8'},
  tableHead: {flexDirection: 'row', gap: 4, marginTop: 4},
  th: {fontSize: 10, fontWeight: '800', color: AYC.textMuted},
  card: {...mobileStyles.card, borderRadius: 10, padding: 10, marginBottom: 6},
  sym: {fontSize: AYC.type.body, fontWeight: '800', color: AYC.text},
  sub: {fontSize: AYC.type.caption, color: AYC.textMuted, marginTop: 2},
  row: {flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6},
  rowBetween: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8},
  meta: {fontSize: AYC.type.caption, color: AYC.text, fontWeight: '600'},
  tierBadge: {borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2},
  tierBadgeText: {color: '#fff', fontSize: 10, fontWeight: '800'},
  err: {color: AYC.negative, fontSize: AYC.type.caption, fontWeight: '700'},
  empty: {textAlign: 'center', color: AYC.textMuted, padding: 24},
});
