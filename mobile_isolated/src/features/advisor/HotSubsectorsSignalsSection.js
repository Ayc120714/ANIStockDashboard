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
import {normalizeHotSubsectorsPayload} from '@core/utils/hotSubsectorsAdvisor';
import {formatINR} from '@core/utils/formatMarket';
import {safeFetch} from '@core/utils/safeFetch';
import {AYC, mobileStyles} from '@core/theme/mobileStyles';

const POLL_MS = 30 * 1000;

export function HotSubsectorsSignalsSection() {
  const [groups, setGroups] = useState([]);
  const [threshold, setThreshold] = useState(75);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async ({silent = false} = {}) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await safeFetch(
        () =>
          advisorService.fetchHotSubsectors({
            all_threshold: 75,
            top_stocks: 5,
            max_subsectors: 40,
            timeoutMs: API_TIMEOUT_MS.advisor,
          }),
        {label: 'Hot Subsectors', timeoutMs: API_TIMEOUT_MS.advisor, retries: 1},
      );
      const normalized = normalizeHotSubsectorsPayload(res);
      setGroups(normalized.subsectors);
      setThreshold(normalized.threshold_all);
    } catch (e) {
      setError(String(e?.message || 'Could not load Hot Subsectors'));
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
      <Text style={mobileStyles.sectionTitle}>Hot Subsectors</Text>
      <Text style={styles.hint}>
        ALL &gt; {threshold} on AYC Subsector Outlook · top 5 stocks by CHG% · live + weekly updates
      </Text>
      <View style={styles.metaRow}>
        <Text style={styles.meta}>{groups.length} hot</Text>
        <Pressable onPress={() => load()} style={styles.refreshBtn}>
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </View>
      {loading && !groups.length ? <ActivityIndicator color={AYC.accent} style={{marginVertical: 16}} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && !error && !groups.length ? (
        <Text style={styles.empty}>No subsectors currently above ALL {threshold}.</Text>
      ) : null}
      {groups.map(g => {
        const stocks = Array.isArray(g.stocks) ? g.stocks : [];
        return (
          <View key={`${g.sector}|${g.subsector}`} style={styles.card}>
            <Text style={styles.subName}>{g.subsector}</Text>
            <Text style={styles.sectorLine}>
              {g.sector || '—'} · ALL {g.all}
              {g.trend && g.trend !== '—' ? ` · ${g.trend}` : ''}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View>
                <View style={styles.thRow}>
                  <Text style={[styles.th, styles.colRank]}>#</Text>
                  <Text style={[styles.th, styles.colSym]}>Symbol</Text>
                  <Text style={[styles.th, styles.colTv]} />
                  <Text style={[styles.th, styles.colNum]}>CMP</Text>
                  <Text style={[styles.th, styles.colNum]}>CHG%</Text>
                </View>
                {stocks.map((s, idx) => {
                  const chg = String(s.chg || '');
                  const down = chg.startsWith('-');
                  return (
                    <View key={s.symbol || idx} style={[styles.tr, idx % 2 === 0 ? styles.trAlt : null]}>
                      <Text style={[styles.td, styles.colRank]}>{idx + 1}</Text>
                      <Text style={[styles.td, styles.colSym, styles.symBold]} numberOfLines={1}>
                        {s.symbol}
                      </Text>
                      <View style={styles.colTv}>
                        <TradingViewLink symbol={s.symbol} />
                      </View>
                      <Text style={[styles.td, styles.colNum]}>
                        {s.cmp != null ? formatINR(s.cmp) : '—'}
                      </Text>
                      <Text
                        style={[
                          styles.td,
                          styles.colNum,
                          {color: down ? AYC.negative : AYC.positive, fontWeight: '700'},
                        ]}>
                        {s.chg || '—'}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {marginBottom: 16},
  hint: {fontSize: 12, color: AYC.textMuted, marginBottom: 8, lineHeight: 16},
  metaRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10},
  meta: {fontSize: 12, color: AYC.textMuted},
  refreshBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: AYC.cardBorder,
  },
  refreshText: {fontSize: 12, color: AYC.accent, fontWeight: '600'},
  error: {color: AYC.negative, marginBottom: 8},
  empty: {color: AYC.textMuted, fontSize: 13, marginVertical: 8},
  card: {
    marginBottom: 14,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: AYC.cardBorder,
  },
  subName: {fontSize: 15, fontWeight: '700', color: AYC.text, marginBottom: 2},
  sectorLine: {fontSize: 12, color: AYC.textMuted, marginBottom: 8},
  thRow: {flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: AYC.cardBorder},
  th: {fontSize: 11, fontWeight: '700', color: AYC.textMuted},
  tr: {flexDirection: 'row', alignItems: 'center', paddingVertical: 6},
  trAlt: {backgroundColor: 'rgba(0,0,0,0.03)'},
  td: {fontSize: 12, color: AYC.text},
  colRank: {width: 28},
  colSym: {width: 88},
  colTv: {width: 36, alignItems: 'center'},
  colNum: {width: 72, textAlign: 'right'},
  symBold: {fontWeight: '700'},
});
