import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ListPagePager} from '@components/ListPagePager';
import {SortableTableHeader} from '@components/SortableTableHeader';
import {TradingViewLink} from '@components/TradingViewLink';
import {dashboardService} from '@core/api/services/dashboardService';
import {MOBILE_PAGE_CACHE_KEYS} from '@core/utils/dashboardCachePolicy';
import {runScreenPayloadFetch} from '@core/utils/screenPageLoader';
import {getScreenSortValue} from '@core/utils/screenSortValues';
import {sortRows} from '@core/utils/tableSort';
import {useTableSort} from '@hooks/useTableSort';
import {AYC, mobileStyles} from '@core/theme/mobileStyles';
import {resolveBottomInset} from '@core/utils/safeAreaTop';

const PAGE_SIZE = 5;

function chgColor(chg) {
  const s = String(chg || '');
  if (s.startsWith('-')) return AYC.negative;
  if (s && s !== '—') return AYC.positive;
  return AYC.text;
}

function dedupeStocks(stocks) {
  const seen = new Set();
  return (stocks || []).filter(stock => {
    const sym = String(stock?.symbol || '').toUpperCase();
    if (!sym || seen.has(sym)) return false;
    seen.add(sym);
    return true;
  });
}

export function SubsectorStocksModal({visible, subsectorName, sectorName, onClose}) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const {sortConfig, onSort, resetSort} = useTableSort('chg', false);

  const sortedRows = useMemo(
    () => sortRows(rows, sortConfig, (row, key) => getScreenSortValue(row, key)),
    [rows, sortConfig],
  );

  const load = useCallback(
    async (pageNum = 1, {forceRefresh = false, hydrateMarketFields = false} = {}) => {
      if (!subsectorName) return;
      const cacheKey = MOBILE_PAGE_CACHE_KEYS.subsectorStocks(subsectorName, pageNum);
      await runScreenPayloadFetch({
        cacheKey,
        fetcher: async () => {
          const paged = await dashboardService.fetchStocksForSubsector(subsectorName, pageNum, PAGE_SIZE, {
            hydrateMarketFields,
          });
          const stocks = dedupeStocks(paged.data);
          return {
            rows: stocks,
            total: Number(paged.total || stocks.length),
            page: pageNum,
          };
        },
        applyPayload: payload => {
          setRows(payload.rows || []);
          setTotal(Number(payload.total || 0));
          setPage(payload.page || pageNum);
        },
        setLoading,
        setError: () => {},
        forceNetwork: forceRefresh,
        hasUsable: data => Array.isArray(data?.rows),
      });
    },
    [subsectorName],
  );

  useEffect(() => {
    if (visible && subsectorName) {
      resetSort();
      load(1);
    } else if (!visible) {
      setRows([]);
      setTotal(0);
      setPage(1);
    }
  }, [visible, subsectorName, load, resetSort]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, {paddingTop: insets.top, paddingBottom: resolveBottomInset(insets)}]}>
        <View style={styles.header}>
          <View style={{flex: 1}}>
            <Text style={styles.title}>Stocks in {subsectorName}</Text>
            {sectorName ? <Text style={styles.sub}>{sectorName}</Text> : null}
          </View>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeTxt}>Close</Text>
          </Pressable>
        </View>

        {loading && !rows.length ? (
          <ActivityIndicator color={AYC.accent} style={{marginTop: 24}} />
        ) : (
          <>
            <View style={styles.tableHead}>
              <Text style={[styles.th, {width: 28}]}>#</Text>
              <Text style={[styles.th, {width: 22}]} />
              <SortableTableHeader
                label="Symbol"
                sortKey="symbol"
                sortConfig={sortConfig}
                onSort={onSort}
                style={{flex: 1}}
                textStyle={styles.th}
              />
              <SortableTableHeader
                label="MC"
                sortKey="mc"
                sortConfig={sortConfig}
                onSort={onSort}
                style={{flex: 0.75}}
                textStyle={styles.th}
              />
              <SortableTableHeader
                label="EMA21"
                sortKey="ema21"
                sortConfig={sortConfig}
                onSort={onSort}
                style={{flex: 0.7}}
                textStyle={styles.th}
              />
              <SortableTableHeader
                label="CMP"
                sortKey="cmp"
                sortConfig={sortConfig}
                onSort={onSort}
                style={{flex: 0.7}}
                textStyle={styles.th}
              />
              <SortableTableHeader
                label="CHG%"
                sortKey="chg"
                sortConfig={sortConfig}
                onSort={onSort}
                style={{flex: 0.6}}
                textStyle={styles.th}
              />
            </View>
            <FlatList
              data={sortedRows}
              keyExtractor={(item, i) => `${item.symbol}-${i}`}
              renderItem={({item, index}) => (
                <View style={[styles.tr, index % 2 === 0 ? styles.trAlt : null]}>
                  <Text style={[styles.td, {width: 28}]}>{(page - 1) * PAGE_SIZE + index + 1}</Text>
                  <View style={{width: 22}}>
                    <TradingViewLink symbol={item.symbol} size={16} />
                  </View>
                  <Text style={[styles.td, {flex: 1, fontWeight: '800'}]}>{item.symbol}</Text>
                  <Text style={[styles.td, {flex: 0.75}]} numberOfLines={1}>
                    {item.mc ?? '—'}
                  </Text>
                  <Text style={[styles.td, {flex: 0.7}]}>{item.ema21 ?? '—'}</Text>
                  <Text style={[styles.td, {flex: 0.7}]}>{item.cmp ?? '—'}</Text>
                  <Text style={[styles.td, {flex: 0.6, color: chgColor(item.chg), fontWeight: '700'}]}>
                    {item.chg ?? '—'}
                  </Text>
                </View>
              )}
              ListEmptyComponent={
                !loading ? <Text style={styles.empty}>No stocks found in this subsector.</Text> : null
              }
            />
          </>
        )}

        {!loading ? (
          <ListPagePager
            page={page}
            totalPages={totalPages}
            totalItems={total}
            onPageChange={nextPage => load(nextPage)}
          />
        ) : null}

        <Pressable
          style={styles.refreshBtn}
          disabled={loading}
          onPress={() => load(page, {forceRefresh: true, hydrateMarketFields: true})}>
          <Text style={styles.refreshTxt}>Refresh live quotes (slower)</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: AYC.pageBg},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: AYC.cardBorder,
    backgroundColor: AYC.card,
  },
  title: mobileStyles.pageTitle,
  sub: mobileStyles.subtitle,
  closeBtn: {paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: AYC.appBar},
  closeTxt: {color: '#fff', fontWeight: '800', fontSize: 12},
  tableHead: {
    flexDirection: 'row',
    backgroundColor: AYC.appBar,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  th: {color: '#fff', fontSize: 10, fontWeight: '800'},
  tr: {flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 10},
  trAlt: {backgroundColor: '#f8fafc'},
  td: {fontSize: 11, color: AYC.text},
  empty: {padding: 24, textAlign: 'center', color: AYC.textMuted},
  refreshBtn: {
    marginHorizontal: 14,
    marginBottom: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: AYC.accent,
    alignItems: 'center',
  },
  refreshTxt: {color: AYC.accent, fontWeight: '800', fontSize: 12},
});
