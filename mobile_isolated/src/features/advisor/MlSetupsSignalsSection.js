import React, {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {TradingViewLink} from '@components/TradingViewLink';
import {advisorService} from '@core/api/services/advisorService';
import {API_TIMEOUT_MS} from '@core/config/apiTimeouts';
import {
  ensureMarketSession,
  getCachedMarketSession,
  getMarketPollingIntervalMs,
  shouldPollLiveMarket,
} from '@core/utils/marketSession';
import {
  formatMlSetupType,
  mlSetupDirectionLabel,
  normalizeMlSetupsPayload,
} from '@core/utils/mlSetupsAdvisor';
import {formatINR} from '@core/utils/formatMarket';
import {safeFetch} from '@core/utils/safeFetch';
import {AYC, mobileStyles} from '@core/theme/mobileStyles';

const POLL_MS = 30 * 1000;

function fmtScore(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : '—';
}

export function MlSetupsSignalsSection() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ready_for_open: false, live_enabled: false, feature_symbols: 0, session_date: ''});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async ({silent = false} = {}) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await safeFetch(
        () =>
          advisorService.fetchMlSetups({
            min_score: 0.55,
            limit: 200,
            timeoutMs: API_TIMEOUT_MS.advisor,
          }),
        {label: 'ML Setups', timeoutMs: API_TIMEOUT_MS.advisor, retries: 1},
      );
      const normalized = normalizeMlSetupsPayload(res);
      setRows(normalized.data);
      setMeta({
        ready_for_open: normalized.ready_for_open,
        live_enabled: normalized.live_enabled,
        feature_symbols: normalized.feature_symbols,
        high_conviction: normalized.high_conviction,
        session_date: normalized.session_date,
        checkpoint: normalized.checkpoint,
      });
    } catch (e) {
      setError(String(e?.message || 'Could not load ML setups'));
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

  return (
    <View style={styles.wrap}>
      <Text style={mobileStyles.sectionTitle}>ML Setups</Text>
      <Text style={styles.hint}>
        Complete live quotes · score ≥ 0.55 · updates in session · retrains at EOD
      </Text>
      <View style={styles.metaRow}>
        <Text style={styles.meta}>
          {meta.live_enabled ? 'Live on' : meta.ready_for_open ? 'Ready before 9 AM' : 'Warming'} · {rows.length} setups
        </Text>
        <Pressable onPress={() => load()} style={styles.refreshBtn}>
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </View>
      {loading && !rows.length ? <ActivityIndicator color={AYC.accent} style={{marginVertical: 16}} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && !error && !rows.length ? (
        <Text style={styles.empty}>No high-conviction setups yet. Data is prepared at 08:50 IST.</Text>
      ) : null}
      {rows.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <View style={styles.thRow}>
              <Text style={[styles.th, styles.colScore]}>ML</Text>
              <Text style={[styles.th, styles.colSym]}>Symbol</Text>
              <Text style={[styles.th, styles.colTv]} />
              <Text style={[styles.th, styles.colSetup]}>Setup</Text>
              <Text style={[styles.th, styles.colSide]}>Side</Text>
              <Text style={[styles.th, styles.colNum]}>Live</Text>
              <Text style={[styles.th, styles.colAlign]}>Align</Text>
            </View>
            {rows.slice(0, 80).map((row, idx) => (
              <View key={`${row.symbol}-${row.alert_type}-${idx}`} style={[styles.tr, idx % 2 === 0 ? styles.trAlt : null]}>
                <Text style={[styles.td, styles.colScore, styles.symBold]}>{fmtScore(row.ml_score)}</Text>
                <Text style={[styles.td, styles.colSym, styles.symBold]} numberOfLines={1}>
                  {row.symbol}
                </Text>
                <View style={styles.colTv}>
                  <TradingViewLink symbol={row.symbol} />
                </View>
                <Text style={[styles.td, styles.colSetup]} numberOfLines={1}>
                  {formatMlSetupType(row.alert_type)}
                </Text>
                <Text style={[styles.td, styles.colSide]}>{mlSetupDirectionLabel(row)}</Text>
                <Text style={[styles.td, styles.colNum]}>
                  {row.live_price != null ? formatINR(row.live_price) : '—'}
                </Text>
                <Text style={[styles.td, styles.colAlign]}>{row.aligned ? 'Yes' : 'Check'}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {marginBottom: 16},
  hint: {color: AYC.textMuted, fontSize: 12, marginBottom: 8, lineHeight: 16},
  metaRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8},
  meta: {color: AYC.textSecondary, fontSize: 12, flex: 1, paddingRight: 8},
  refreshBtn: {borderWidth: 1, borderColor: AYC.border, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4},
  refreshText: {color: AYC.accent, fontSize: 12, fontWeight: '600'},
  error: {color: AYC.negative, marginBottom: 8},
  empty: {color: AYC.textMuted, marginVertical: 12},
  thRow: {flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: AYC.border, paddingBottom: 6},
  tr: {flexDirection: 'row', alignItems: 'center', paddingVertical: 6},
  trAlt: {backgroundColor: AYC.rowAlt},
  th: {color: AYC.textMuted, fontSize: 11, fontWeight: '700'},
  td: {color: AYC.text, fontSize: 12},
  colScore: {width: 44},
  colSym: {width: 88},
  colTv: {width: 28, alignItems: 'center'},
  colSetup: {width: 150},
  colSide: {width: 48},
  colNum: {width: 72, textAlign: 'right'},
  colAlign: {width: 48, textAlign: 'center'},
  symBold: {fontWeight: '700'},
});
