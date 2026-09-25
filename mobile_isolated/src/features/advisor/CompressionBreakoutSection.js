import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, Text, View} from 'react-native';
import {ListPagePager} from '@components/ListPagePager';
import {TradingViewLink} from '@components/TradingViewLink';
import {advisorService} from '@core/api/services/advisorService';
import {API_TIMEOUT_MS} from '@core/config/apiTimeouts';
import {formatINR} from '@core/utils/formatMarket';
import {safeFetch} from '@core/utils/safeFetch';
import {buildTradingViewSymbolsCsv} from '@core/utils/tradingViewCsv';
import {usePagedList} from '@hooks/usePagedList';
import {AYC, mobileStyles} from '@core/theme/mobileStyles';

const PAGE_SIZE = 15;

const TF_FILTERS = [
  {id: 'all', label: 'All'},
  {id: '1d', label: 'Daily'},
  {id: '1w', label: 'Weekly'},
];

const PHASE_FILTERS = [
  {id: '', label: 'All'},
  {id: 'breakout', label: 'Breakout'},
  {id: 'retest_hold', label: 'Retest'},
  {id: 'renewed', label: 'Renewed'},
  {id: 'compression', label: 'Compress'},
  {id: 'cup60', label: '60% cup'},
];

function phaseLabel(p) {
  const key = String(p || '');
  if (key === 'breakout') return 'Breakout';
  if (key === 'retest_hold') return 'Retest';
  if (key === 'renewed') return 'Renewed';
  if (key === 'compression') return 'Compress';
  if (key === 'cup60') return '60% cup';
  return key || '—';
}

function phaseColor(p) {
  const key = String(p || '');
  if (key === 'renewed') return '#1b5e20';
  if (key === 'retest_hold') return '#1565c0';
  if (key === 'breakout') return '#e65100';
  if (key === 'cup60') return '#1b5e20';
  return '#546e7a';
}

export function CompressionBreakoutSection() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeframe, setTimeframe] = useState('all');
  const [phase, setPhase] = useState('');

  const load = useCallback(async ({silent = false} = {}) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await safeFetch(
        () =>
          phase === 'cup60'
            ? advisorService.fetchCupSixty({
                timeframe,
                limit: 200,
                symbol_limit: 800,
                timeoutMs: API_TIMEOUT_MS.screenHeavy,
              })
            : advisorService.fetchCompressionBreakout({
                timeframe,
                limit: 300,
                symbol_limit: 800,
                phase: phase || undefined,
                include_compression: phase === 'compression',
                timeoutMs: API_TIMEOUT_MS.screenHeavy,
              }),
        {label: phase === 'cup60' ? '60% cup' : 'Compression Breakout', timeoutMs: API_TIMEOUT_MS.screenHeavy, retries: 1},
      );
      setRows(Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []);
    } catch (e) {
      setError(String(e?.message || 'Could not load Compression Breakout'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [timeframe, phase]);

  useEffect(() => {
    load();
  }, [load]);

  const {page, setPage, totalPages, pagedItems, totalItems} = usePagedList(rows, {
    pageSize: PAGE_SIZE,
    resetDeps: [timeframe, phase, rows.length],
  });

  const subtitle = useMemo(
    () =>
      `${timeframe === 'all' ? 'All TFs' : timeframe === '1w' ? 'Weekly' : 'Daily'} · compression → breakout → light retest → renewed · ${rows.length} matches`,
    [rows.length, timeframe],
  );

  return (
    <View>
      <Text style={mobileStyles.subtitle}>{subtitle}</Text>
      <Text style={styles.hint}>
        Checklist: compression first, volume expanded + strong close, level held on lighter retest, then renewed
        participation. Better evidence, not certainty.
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {TF_FILTERS.map(f => (
          <Pressable
            key={f.id}
            onPress={() => setTimeframe(f.id)}
            style={[styles.chip, timeframe === f.id ? styles.chipOn : null]}>
            <Text style={[styles.chipText, timeframe === f.id ? styles.chipTextOn : null]}>{f.label}</Text>
          </Pressable>
        ))}
        {PHASE_FILTERS.map(f => (
          <Pressable
            key={f.id || 'all'}
            onPress={() => setPhase(f.id)}
            style={[styles.chip, phase === f.id ? styles.chipOn : null]}>
            <Text style={[styles.chipText, phase === f.id ? styles.chipTextOn : null]}>{f.label}</Text>
          </Pressable>
        ))}
        <Pressable
          onPress={async () => {
            const csv = buildTradingViewSymbolsCsv(rows.map(r => r.symbol));
            if (!csv) {
              Alert.alert('Copy CSV', 'No symbols to copy.');
              return;
            }
            try {
              await Share.share({message: csv, title: 'Compression Breakout CSV'});
            } catch (e) {
              Alert.alert('Copy CSV', String(e?.message || 'Could not share CSV'));
            }
          }}
          style={styles.chip}>
          <Text style={styles.chipText}>Copy CSV ({rows.length})</Text>
        </Pressable>
        <Pressable onPress={() => load({silent: false})} style={styles.chip}>
          <Text style={styles.chipText}>Refresh</Text>
        </Pressable>
      </ScrollView>

      {loading && !rows.length ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={AYC.blue} />
          <Text style={styles.loadingText}>Scanning compression / breakout universe…</Text>
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!loading && !rows.length && !error ? (
        <Text style={styles.empty}>No matching setups for these filters.</Text>
      ) : null}

      {pagedItems.length > 0 ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              <View style={styles.thRow}>
                <Text style={[styles.th, styles.colSym]}>Symbol</Text>
                <Text style={[styles.th, styles.colTv]} />
                <Text style={[styles.th, styles.colPhase]}>Phase</Text>
                <Text style={[styles.th, styles.colNum]}>Ev</Text>
                <Text style={[styles.th, styles.colPx]}>Close</Text>
                <Text style={[styles.th, styles.colPx]}>Level</Text>
                <Text style={[styles.th, styles.colPx]}>Stop</Text>
              </View>
              {pagedItems.map((row, index) => (
                <View key={`${row.symbol}-${index}`} style={[styles.tr, index % 2 === 0 ? styles.trAlt : null]}>
                  <Text style={[styles.td, styles.colSym, styles.symBold]} numberOfLines={1}>
                    {row.symbol}
                  </Text>
                  <View style={[styles.td, styles.colTv]}>
                    <TradingViewLink symbol={row.symbol} />
                  </View>
                  <Text style={[styles.td, styles.colPhase, {color: phaseColor(row.phase)}]} numberOfLines={1}>
                    {phaseLabel(row.phase)}
                  </Text>
                  <Text style={[styles.td, styles.colNum]}>
                    {row.evidence_score != null ? `${row.evidence_score}/${row.evidence_max || 6}` : '—'}
                  </Text>
                  <Text style={[styles.td, styles.colPx]}>{row.close != null ? formatINR(row.close) : '—'}</Text>
                  <Text style={[styles.td, styles.colPx]}>
                    {row.breakout_level != null ? formatINR(row.breakout_level) : '—'}
                  </Text>
                  <Text style={[styles.td, styles.colPx]}>{row.stop_hint != null ? formatINR(row.stop_hint) : '—'}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
          <ListPagePager page={page} totalPages={totalPages} totalItems={totalItems} onPageChange={setPage} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hint: {fontSize: 11, color: AYC.muted || '#78909c', marginBottom: 8, lineHeight: 15},
  chipRow: {flexDirection: 'row', gap: 8, paddingVertical: 6, marginBottom: 8},
  chip: {
    borderWidth: 1,
    borderColor: '#cfd8dc',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#fff',
  },
  chipOn: {backgroundColor: '#1565c0', borderColor: '#1565c0'},
  chipText: {fontSize: 12, color: '#455a64', fontWeight: '600'},
  chipTextOn: {color: '#fff'},
  loadingWrap: {alignItems: 'center', paddingVertical: 24, gap: 8},
  loadingText: {fontSize: 12, color: '#78909c'},
  error: {color: '#c62828', fontSize: 12, marginVertical: 8},
  empty: {color: '#78909c', fontSize: 13, marginVertical: 16},
  thRow: {flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#eceff1', paddingBottom: 6},
  th: {fontSize: 11, fontWeight: '700', color: '#546e7a'},
  tr: {flexDirection: 'row', paddingVertical: 7, alignItems: 'center'},
  trAlt: {backgroundColor: '#fafafa'},
  td: {fontSize: 12, color: '#37474f'},
  symBold: {fontWeight: '700'},
  colSym: {width: 88},
  colTv: {width: 28},
  colPhase: {width: 72},
  colNum: {width: 40, textAlign: 'right'},
  colPx: {width: 72, textAlign: 'right'},
});
