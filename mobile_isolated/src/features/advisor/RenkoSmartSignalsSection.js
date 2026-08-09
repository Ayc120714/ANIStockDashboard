import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {ListPagePager} from '@components/ListPagePager';
import {TradingViewLink} from '@components/TradingViewLink';
import {SortableTableHeader} from '@components/SortableTableHeader';
import {advisorService} from '@core/api/services/advisorService';
import {API_TIMEOUT_MS} from '@core/config/apiTimeouts';
import {
  ensureMarketSession,
  getCachedMarketSession,
  getMarketPollingIntervalMs,
  shouldPollLiveMarket,
} from '@core/utils/marketSession';
import {formatINR} from '@core/utils/formatMarket';
import {safeFetch} from '@core/utils/safeFetch';
import {buildTradingViewSymbolsCsv} from '@core/utils/tradingViewCsv';
import {usePagedList} from '@hooks/usePagedList';
import {useTableSort} from '@hooks/useTableSort';
import {AYC} from '@core/theme/mobileStyles';
import {MOBILE_TIER_TABLE_PAGE_SIZE} from '@core/utils/advisorWebParity';

const PAGE_SIZE = MOBILE_TIER_TABLE_PAGE_SIZE;
const POLL_MS = 5 * 60 * 1000;
const LIST_LIMIT = 10;

const COLS = [
  {key: 'symbol', label: 'Symbol'},
  {key: 'signal_time_5m', label: 'Time'},
  {key: 'close', label: 'CMP'},
  {key: 'upper_44', label: 'U44'},
  {key: 'upper_50', label: 'U50'},
  {key: 'ema10', label: 'EMA10'},
  {key: 'ema30', label: 'EMA30'},
  {key: 'supertrend', label: 'ST'},
  {key: 'target_1', label: 'T1'},
  {key: 'target_2', label: 'T2'},
  {key: 'stop_loss', label: 'SL'},
];

function fmtNum(v) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return Number(v).toFixed(2);
}

export function RenkoSmartSignalsSection() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scanSymbols, setScanSymbols] = useState(0);
  const [sessionDate, setSessionDate] = useState('');
  const {sortConfig, onSort} = useTableSort({defaultCol: 'signal_time_5m', defaultDir: 'desc'});

  const load = useCallback(async ({silent = false, refresh = false} = {}) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await safeFetch(
        () =>
          advisorService.fetchRenkoSmartSignals({
            limit: LIST_LIMIT,
            symbol_limit: 1500,
            hits_only: true,
            refresh,
            timeoutMs: API_TIMEOUT_MS.advisor,
          }),
        {label: 'Renko Smart', timeoutMs: API_TIMEOUT_MS.advisor, retries: 1},
      );
      const data = Array.isArray(res?.data) ? res.data : [];
      setRows(data);
      setScanSymbols(Number(res?.scan_symbols) || data.length || 0);
      setSessionDate(String(res?.session_date || ''));
    } catch (e) {
      setError(String(e?.message || 'Could not load Renko Smart'));
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
      if (col === 'symbol' || col === 'signal_time_5m') {
        const av = String(a[col] || a.bar_time_5m || '');
        const bv = String(b[col] || b.bar_time_5m || '');
        return dir * av.localeCompare(bv);
      }
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

  const handleCopyCsv = async () => {
    const csv = buildTradingViewSymbolsCsv(sorted.map(r => r.symbol));
    if (!csv) return;
    try {
      await Share.share({message: csv, title: 'Renko Smart CSV'});
    } catch (e) {
      Alert.alert('Copy CSV', String(e?.message || 'Could not share CSV'));
    }
  };

  const cellValue = (row, key) => {
    if (key === 'signal_time_5m') {
      const s = String(row.signal_time_5m || row.bar_time_5m || '');
      const m = s.match(/(\d{2}:\d{2})/);
      return m ? m[1] : s || '—';
    }
    if (key === 'close') return formatINR(row.close);
    if (key === 'ema10') return fmtNum(row.ema10 ?? row.ma1);
    if (key === 'ema30') return fmtNum(row.ema30 ?? row.ma2);
    return fmtNum(row[key]);
  };

  return (
    <View style={styles.block}>
      <View style={styles.head}>
        <Text style={styles.title}>Renko Smart</Text>
        <Text style={styles.count}>
          {totalItems}/{LIST_LIMIT} · {scanSymbols} scanned · 5m
          {sessionDate ? ` · ${sessionDate}` : ''}
        </Text>
      </View>
      <Text style={styles.subtitle}>
        Latest {LIST_LIMIT} for session day · upper Renko 44–50% · cloud green · ST flip
      </Text>
      <View style={styles.actions}>
        <Pressable onPress={() => load({refresh: true})} style={styles.refreshBtn}>
          <Text style={styles.refreshTxt}>Refresh</Text>
        </Pressable>
        <Pressable
          onPress={handleCopyCsv}
          disabled={!sorted.length}
          style={[styles.refreshBtn, !sorted.length && styles.btnDisabled]}>
          <Text style={styles.refreshTxt}>Copy CSV ({sorted.length})</Text>
        </Pressable>
      </View>
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
                <View key={`${row.symbol}-${row.bar_time_5m || ''}`} style={styles.tr}>
                  {COLS.map(col =>
                    col.key === 'symbol' ? (
                      <View key={col.key} style={styles.symTd}>
                        <TradingViewLink symbol={row.symbol} />
                      </View>
                    ) : (
                      <Text key={col.key} style={styles.td}>
                        {cellValue(row, col.key)}
                      </Text>
                    ),
                  )}
                </View>
              ))}
              {pagedItems.length === 0 ? (
                <Text style={styles.empty}>No combined Renko Smart 5m setups yet.</Text>
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
  subtitle: {fontSize: 11, color: AYC.muted, marginBottom: 8},
  actions: {flexDirection: 'row', gap: 8, marginBottom: 8},
  refreshBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: AYC.border,
    borderRadius: 6,
  },
  btnDisabled: {opacity: 0.45},
  refreshTxt: {fontSize: 12, color: AYC.accent},
  error: {fontSize: 12, color: '#c62828', marginBottom: 8},
  thRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: AYC.border,
    paddingBottom: 6,
    marginBottom: 4,
  },
  th: {width: 64, fontSize: 11, fontWeight: '600', color: AYC.muted},
  symTh: {width: 88, fontSize: 11, fontWeight: '600', color: AYC.muted},
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: AYC.border,
  },
  symTd: {width: 88},
  td: {width: 64, fontSize: 12, color: AYC.text},
  empty: {padding: 16, fontSize: 12, color: AYC.muted, textAlign: 'center'},
});
