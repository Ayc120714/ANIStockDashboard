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

const TIMING_FILTERS = [
  {id: '', label: 'All'},
  {id: 'breakout_watch', label: 'Breakout'},
  {id: 'constructive_pullback', label: 'Pullback'},
  {id: 'stage2_watch', label: 'Watch'},
  {id: 'extended', label: 'Extended'},
];

function fmtPct(v) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return `${Number(v).toFixed(1)}%`;
}

function timingLabel(t) {
  const key = String(t || '');
  if (key === 'breakout_watch') return 'Breakout';
  if (key === 'constructive_pullback') return 'Pullback';
  if (key === 'stage2_watch') return 'Watch';
  if (key === 'extended') return 'Extended';
  if (key === 'deteriorating') return 'Weak';
  return key || '—';
}

export function StageEntryTimingSection() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timing, setTiming] = useState('');
  const [timeframe, setTimeframe] = useState('1d');
  const [requireRs70, setRequireRs70] = useState(false);
  const [rsCrossAbove70, setRsCrossAbove70] = useState(false);
  const [mtfConfirm, setMtfConfirm] = useState(true);

  const load = useCallback(async ({silent = false} = {}) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await safeFetch(
        () =>
          advisorService.fetchStageEntryTiming({
            timeframe,
            limit: 300,
            symbol_limit: 800,
            min_template_score: 6,
            require_rs_70: requireRs70,
            rs_cross_above_70: rsCrossAbove70,
            require_mtf_confirm: timeframe === '5m' ? false : mtfConfirm,
            entry_timing: timing || undefined,
            timeoutMs: API_TIMEOUT_MS.screenHeavy,
          }),
        {label: 'Stage Analysis', timeoutMs: API_TIMEOUT_MS.screenHeavy, retries: 1},
      );
      setRows(Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []);
    } catch (e) {
      setError(String(e?.message || 'Could not load Stage Analysis'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [requireRs70, rsCrossAbove70, mtfConfirm, timing, timeframe]);

  useEffect(() => {
    load();
  }, [load]);

  const {page, setPage, totalPages, pagedItems, totalItems} = usePagedList(rows, {
    pageSize: PAGE_SIZE,
    resetDeps: [timing, timeframe, requireRs70, rsCrossAbove70, mtfConfirm, rows.length],
  });

  const subtitle = useMemo(() => {
    const parts = [];
    if (mtfConfirm) parts.push('PSAR D/W/M');
    if (rsCrossAbove70) parts.push('RS↑70');
    parts.push(`${rows.length} matches`);
    return parts.join(' · ');
  }, [rows.length, mtfConfirm, rsCrossAbove70]);

  return (
    <View>
      <Text style={mobileStyles.subtitle}>{subtitle}</Text>
      <Text style={styles.hint}>
        One list for all formats: Stage 2 + Minervini + Chartink PSAR confirm on Daily, Weekly, or
        Monthly (same formula). Market Cap &gt; 2000 Cr.
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {[
          {id: '1d', label: 'Daily'},
          {id: '5m', label: '5 min'},
        ].map(f => (
          <Pressable
            key={f.id}
            onPress={() => setTimeframe(f.id)}
            style={[styles.chip, timeframe === f.id ? styles.chipOn : null]}>
            <Text style={[styles.chipText, timeframe === f.id ? styles.chipTextOn : null]}>{f.label}</Text>
          </Pressable>
        ))}
        {TIMING_FILTERS.map(f => (
          <Pressable
            key={f.id || 'all'}
            onPress={() => setTiming(f.id)}
            style={[styles.chip, timing === f.id ? styles.chipOn : null]}>
            <Text style={[styles.chipText, timing === f.id ? styles.chipTextOn : null]}>{f.label}</Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => setMtfConfirm(v => !v)}
          style={[styles.chip, mtfConfirm ? styles.chipOn : null]}>
          <Text style={[styles.chipText, mtfConfirm ? styles.chipTextOn : null]}>PSAR D/W/M</Text>
        </Pressable>
        <Pressable
          onPress={() => setRsCrossAbove70(v => !v)}
          style={[styles.chip, rsCrossAbove70 ? styles.chipOn : null]}>
          <Text style={[styles.chipText, rsCrossAbove70 ? styles.chipTextOn : null]}>RS↑70</Text>
        </Pressable>
        <Pressable
          onPress={() => setRequireRs70(v => !v)}
          style={[styles.chip, requireRs70 && !rsCrossAbove70 ? styles.chipOn : null]}>
          <Text style={[styles.chipText, requireRs70 && !rsCrossAbove70 ? styles.chipTextOn : null]}>RS ≥70</Text>
        </Pressable>
        <Pressable
          onPress={async () => {
            const csv = buildTradingViewSymbolsCsv(rows.map(r => r.symbol));
            if (!csv) {
              Alert.alert('Copy CSV', 'No symbols to copy.');
              return;
            }
            try {
              await Share.share({message: csv, title: 'Stage Analysis CSV'});
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
          <Text style={styles.loadingText}>Scanning Stage 2 + PSAR D/W/M…</Text>
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!loading && !rows.length && !error ? (
        <Text style={styles.empty}>No Stage 2 setups for these filters.</Text>
      ) : null}

      {pagedItems.length > 0 ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              <View style={styles.thRow}>
                <Text style={[styles.th, styles.colSym]}>Symbol</Text>
                <Text style={[styles.th, styles.colTv]} />
                <Text style={[styles.th, styles.colNum]}>Tmpl</Text>
                <Text style={[styles.th, styles.colWk]}>TF</Text>
                <Text style={[styles.th, styles.colRs]}>RS</Text>
                <Text style={[styles.th, styles.colTiming]}>Timing</Text>
                <Text style={[styles.th, styles.colPx]}>Close</Text>
                <Text style={[styles.th, styles.colNum]}>%H</Text>
              </View>
              {pagedItems.map((row, index) => (
                <View key={`${row.symbol}-${index}`} style={[styles.tr, index % 2 === 0 ? styles.trAlt : null]}>
                  <Text style={[styles.td, styles.colSym, styles.symBold]} numberOfLines={1}>
                    {row.symbol}
                  </Text>
                  <View style={[styles.td, styles.colTv]}>
                    <TradingViewLink symbol={row.symbol} />
                  </View>
                  <Text style={[styles.td, styles.colNum]}>
                    {row.minervini_score != null ? `${row.minervini_score}/8` : '—'}
                  </Text>
                  <Text
                    style={[
                      styles.td,
                      styles.colWk,
                      row.mtf_confirm_pass ? styles.rsOk : styles.rsFail,
                    ]}
                    numberOfLines={1}>
                    {row.mtf_confirm_pass
                      ? (row.confirm_timeframes || []).map(tf => (tf === '1d' ? 'D' : tf === '1w' ? 'W' : 'M')).join('+') || 'Pass'
                      : '—'}
                  </Text>
                  <Text
                    style={[
                      styles.td,
                      styles.colRs,
                      row.rs_just_crossed_70 || (row.rs_rating != null && row.rs_rating >= 70)
                        ? styles.rsOk
                        : styles.rsFail,
                    ]}>
                    {row.rs_rating_prev != null && row.rs_rating != null
                      ? `${row.rs_rating_prev}→${row.rs_rating}`
                      : row.rs_rating != null
                        ? String(row.rs_rating)
                        : '—'}
                  </Text>
                  <Text style={[styles.td, styles.colTiming]} numberOfLines={1}>
                    {timingLabel(row.entry_timing)}
                  </Text>
                  <Text style={[styles.td, styles.colPx]}>{row.close != null ? formatINR(row.close) : '—'}</Text>
                  <Text style={[styles.td, styles.colNum]}>{fmtPct(row.pct_from_high)}</Text>
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
  colNum: {width: 48, textAlign: 'right'},
  colWk: {width: 44, textAlign: 'center'},
  colRs: {width: 64, textAlign: 'right'},
  colTiming: {width: 72},
  colPx: {width: 72, textAlign: 'right'},
  rsOk: {color: '#1b5e20', fontWeight: '700'},
  rsFail: {color: '#c62828', fontWeight: '700'},
});
