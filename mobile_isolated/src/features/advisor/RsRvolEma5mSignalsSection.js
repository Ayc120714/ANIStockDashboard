import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {ListPagePager} from '@components/ListPagePager';
import {TradingViewLink} from '@components/TradingViewLink';
import {SortableTableHeader} from '@components/SortableTableHeader';
import {advisorService} from '@core/api/services/advisorService';
import {API_TIMEOUT_MS} from '@core/config/apiTimeouts';
import {extractApiRows} from '@core/utils/apiPayload';
import {
  ensureMarketSession,
  getCachedMarketSession,
  getMarketPollingIntervalMs,
  shouldPollLiveMarket,
} from '@core/utils/marketSession';
import {SCREEN_LIVE_POLL_MS} from '@core/utils/screenPageLoader';
import {formatINR} from '@core/utils/formatMarket';
import {safeFetch} from '@core/utils/safeFetch';
import {usePagedList} from '@hooks/usePagedList';
import {useTableSort} from '@hooks/useTableSort';
import {AYC, mobileStyles} from '@core/theme/mobileStyles';
import {MOBILE_TIER_TABLE_PAGE_SIZE} from '@core/utils/advisorWebParity';

const PAGE_SIZE = MOBILE_TIER_TABLE_PAGE_SIZE;
const POLL_MS = 5 * 60 * 1000;

const COLS = [
  {key: 'symbol', label: 'Symbol'},
  {key: 'relative_volume', label: 'RVOL'},
  {key: 'daily_close', label: 'Close'},
  {key: 'close_5m', label: '5m'},
  {key: 'entry', label: 'Entry'},
  {key: 'stop_loss', label: 'SL'},
  {key: 'target_1', label: 'T1'},
];

function fmtNum(v) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return Number(v).toFixed(2);
}

export function RsRvolEma5mSignalsSection() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scanSymbols, setScanSymbols] = useState(0);
  const {sortConfig, onSort} = useTableSort({defaultCol: 'relative_volume', defaultDir: 'desc'});

  const load = useCallback(async ({silent = false, refresh = false} = {}) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await safeFetch(
        () =>
          advisorService.fetchRsRvolEma5mSignals({
            limit: 500,
            symbol_limit: 1500,
            rvol_min: 1.5,
            refresh,
            timeoutMs: API_TIMEOUT_MS.advisor,
          }),
        {label: 'RS+RVOL+EMA5m', timeoutMs: API_TIMEOUT_MS.advisor, retries: 1},
      );
      const data = extractApiRows(res, ['data']);
      setRows(Array.isArray(data) ? data : []);
      setScanSymbols(Number(res?.scan_symbols) || data?.length || 0);
    } catch (e) {
      setError(String(e?.message || 'Could not load screener'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    let pollId;
    void (async () => {
      await ensureMarketSession();
      const pollMs = getMarketPollingIntervalMs(POLL_MS, 0);
      if (pollMs <= 0) return;
      pollId = setInterval(() => {
        if (!shouldPollLiveMarket(getCachedMarketSession())) return;
        load({silent: true});
      }, pollMs);
    })();
    return () => {
      if (pollId) clearInterval(pollId);
    };
  }, [load]);

  const sorted = useMemo(() => {
    const col = sortConfig.col;
    const dir = sortConfig.dir === 'asc' ? 1 : -1;
    const list = [...rows];
    if (!col) return list;
    list.sort((a, b) => {
      if (col === 'symbol') return dir * String(a.symbol || '').localeCompare(String(b.symbol || ''));
      const na = Number(a[col]);
      const nb = Number(b[col]);
      if (!Number.isFinite(na) && !Number.isFinite(nb)) return 0;
      if (!Number.isFinite(na)) return 1;
      if (!Number.isFinite(nb)) return -1;
      return dir * (na - nb);
    });
    return list;
  }, [rows, sortConfig.col, sortConfig.dir]);

  const {page, setPage, totalPages, pagedItems, totalItems} = usePagedList(sorted, {
    pageSize: PAGE_SIZE,
    resetDeps: [sorted.length, sortConfig.col, sortConfig.dir],
  });

  return (
    <View style={styles.block}>
      <View style={styles.head}>
        <Text style={styles.title}>RS + RVOL + EMA5m</Text>
        <Text style={styles.count}>{totalItems} · {scanSymbols} scanned</Text>
      </View>
      <Text style={mobileStyles.subtitle}>
        RS(123) cross · RVOL &gt; 1.5 · close &gt; EMA200 · 5m EMA21 cross-up · 5m refresh
      </Text>
      <Pressable onPress={() => load({refresh: true})} style={styles.refreshBtn}>
        <Text style={styles.refreshTxt}>Refresh</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading && rows.length === 0 ? (
        <ActivityIndicator color={AYC.accent} style={{marginVertical: 16}} />
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              <View style={styles.thRow}>
                {COLS.map(col => (
                  <SortableTableHeader
                    key={col.key}
                    label={col.label}
                    colKey={col.key}
                    sortCol={sortConfig.col}
                    sortDir={sortConfig.dir}
                    onSort={onSort}
                    style={col.key === 'symbol' ? styles.symTh : styles.th}
                  />
                ))}
              </View>
              {pagedItems.map(row => (
                <View key={row.symbol} style={styles.tr}>
                  <View style={styles.symTd}>
                    <TradingViewLink symbol={row.symbol} />
                  </View>
                  <Text style={styles.td}>{row.relative_volume != null ? `${fmtNum(row.relative_volume)}x` : '—'}</Text>
                  <Text style={styles.td}>{formatINR(row.daily_close)}</Text>
                  <Text style={styles.td}>{formatINR(row.close_5m)}</Text>
                  <Text style={styles.td}>{formatINR(row.entry)}</Text>
                  <Text style={styles.td}>{formatINR(row.stop_loss)}</Text>
                  <Text style={styles.td}>{formatINR(row.target_1)}</Text>
                </View>
              ))}
              {pagedItems.length === 0 ? (
                <Text style={styles.empty}>No matches.</Text>
              ) : null}
            </View>
          </ScrollView>
          <ListPagePager page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {marginBottom: 20},
  head: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4},
  title: {fontSize: 16, fontWeight: '700', color: AYC.text},
  count: {fontSize: 12, color: AYC.muted},
  refreshBtn: {alignSelf: 'flex-start', marginBottom: 8, paddingVertical: 4, paddingHorizontal: 10, borderWidth: 1, borderColor: AYC.border, borderRadius: 6},
  refreshTxt: {fontSize: 12, color: AYC.accent},
  error: {fontSize: 12, color: '#c62828', marginBottom: 8},
  thRow: {flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: AYC.border, paddingBottom: 6, marginBottom: 4},
  th: {width: 72, fontSize: 11, fontWeight: '600', color: AYC.muted},
  symTh: {width: 88, fontSize: 11, fontWeight: '600', color: AYC.muted},
  tr: {flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: AYC.border},
  symTd: {width: 88},
  td: {width: 72, fontSize: 12, color: AYC.text},
  empty: {padding: 16, fontSize: 12, color: AYC.muted, textAlign: 'center'},
});
