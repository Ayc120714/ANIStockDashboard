import React, {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';
import {dashboardService} from '@core/api/services/dashboardService';
import {API_TIMEOUT_MS} from '@core/config/apiTimeouts';
import {AYC} from '@core/theme/aycMobileTheme';
import {
  formatInrPrice,
  formatInrVolume,
  formatIndexValue,
  formatPctDelta,
  normalizeDailyMarketUpdatePayload,
  splitBoldSegments,
} from '@core/utils/dailyMarketUpdatePayload';
import {safeFetch} from '@core/utils/safeFetch';

function BoldParagraph({text, style}) {
  const parts = splitBoldSegments(text);
  return (
    <Text style={[styles.para, style]}>
      {parts.map((p, i) =>
        p.bold ? (
          <Text key={i} style={styles.bold}>
            {p.text}
          </Text>
        ) : (
          <Text key={i}>{p.text}</Text>
        ),
      )}
    </Text>
  );
}

function Card({children}) {
  return <View style={styles.card}>{children}</View>;
}

export function DailyMarketUpdateSection({refreshToken = 0}) {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const raw = await safeFetch(
        () =>
          dashboardService.fetchDailyMarketUpdate({
            volumeLimit: 10,
            sectorTopN: 5,
            timeoutMs: API_TIMEOUT_MS.screenHeavy,
          }),
        {label: 'Daily market update', timeoutMs: API_TIMEOUT_MS.screenHeavy, retries: 1},
      );
      setPayload(normalizeDailyMarketUpdatePayload(raw));
    } catch (e) {
      setError(String(e?.message || 'Could not load daily update'));
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshToken]);

  if (loading && !payload) {
    return <ActivityIndicator color={AYC.accent} style={{marginVertical: 24}} />;
  }
  if (error && !payload) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.error}>{error}</Text>
        <Pressable onPress={load} style={styles.refreshBtn}>
          <Text style={styles.refreshTxt}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const b = payload.breadth;
  const advW = Math.max(b.advancesPct, 0);
  const uncW = Math.max(b.unchangedPct, 0);
  const decW = Math.max(b.declinesPct, 0);
  const barTotal = advW + uncW + decW || 1;

  return (
    <View style={styles.wrap}>
      <View style={styles.headRow}>
        <View style={{flex: 1}}>
          <Text style={styles.eyebrow}>DAILY MARKET UPDATE</Text>
          <Text style={styles.title}>{payload.title}</Text>
          <Text style={styles.meta}>{payload.asOfLabel}</Text>
          <Text style={styles.meta}>Last updated: {payload.lastUpdatedIst}</Text>
        </View>
        <Pressable onPress={load} style={styles.refreshBtn}>
          <Text style={styles.refreshTxt}>Refresh</Text>
        </Pressable>
      </View>

      <Text style={styles.headline}>{payload.narratives.headline}</Text>
      <View style={styles.leadBlock}>
        <BoldParagraph text={payload.narratives.executiveSummary} />
      </View>
      <View style={styles.callout}>
        <Text style={styles.calloutTxt}>{payload.narratives.disclaimer}</Text>
      </View>

      <Card>
        <Text style={styles.cardLabel}>MARKET BREADTH</Text>
        <View style={styles.bar}>
          <View style={[styles.barSeg, {flex: advW / barTotal, backgroundColor: AYC.positive}]} />
          <View style={[styles.barSeg, {flex: uncW / barTotal, backgroundColor: '#9ca3af'}]} />
          <View style={[styles.barSeg, {flex: decW / barTotal, backgroundColor: AYC.negative}]} />
        </View>
        <View style={styles.breadthRow}>
          <View style={styles.breadthCol}>
            <Text style={styles.mutedSm}>ADVANCES</Text>
            <Text style={[styles.bigNum, {color: AYC.positive}]}>{b.advances}</Text>
            <Text style={styles.mutedSm}>{b.advancesPct}%</Text>
          </View>
          <View style={styles.breadthCol}>
            <Text style={styles.mutedSm}>UNCHANGED</Text>
            <Text style={[styles.bigNum, {color: AYC.muted}]}>{b.unchanged}</Text>
            <Text style={styles.mutedSm}>{b.unchangedPct}%</Text>
          </View>
          <View style={styles.breadthCol}>
            <Text style={styles.mutedSm}>DECLINES</Text>
            <Text style={[styles.bigNum, {color: AYC.negative}]}>{b.declines}</Text>
            <Text style={styles.mutedSm}>{b.declinesPct}%</Text>
          </View>
        </View>
        <Text style={styles.ratio}>
          Advance / Decline ratio:{' '}
          <Text style={styles.bold}>{b.advanceDeclineRatio == null ? '—' : b.advanceDeclineRatio}</Text>
        </Text>
      </Card>

      <Card>
        <Text style={styles.cardLabel}>SECTOR PULSE</Text>
        <View style={styles.pulseRow}>
          <View style={styles.pulseCol}>
            <Text style={[styles.pulseHead, {color: AYC.positive}]}>TOP GAINERS</Text>
            {payload.sectorPulse.topGainers.map(row => (
              <View key={row.code} style={styles.pulseLine}>
                <Text style={styles.pulseCode}>{row.code}</Text>
                <Text style={{color: AYC.positive, fontWeight: '700'}}>
                  {formatPctDelta(row.pct).text.replace(/^↑\s*/, '')}
                </Text>
              </View>
            ))}
          </View>
          <View style={styles.pulseCol}>
            <Text style={[styles.pulseHead, {color: AYC.negative}]}>TOP LOSERS</Text>
            {payload.sectorPulse.topLosers.map(row => (
              <View key={row.code} style={styles.pulseLine}>
                <Text style={styles.pulseCode}>{row.code}</Text>
                <Text style={{color: AYC.negative, fontWeight: '700'}}>
                  {formatPctDelta(row.pct).text.replace(/^↓\s*/, '')}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </Card>

      <Text style={styles.section}>Market Snapshot</Text>
      <BoldParagraph text={payload.narratives.marketSnapshot} />

      <Text style={styles.section}>Index Performance</Text>
      <BoldParagraph text={payload.narratives.indexPerformance} />

      <Text style={styles.section}>Sector Pulse</Text>
      <BoldParagraph text={payload.narratives.sectorPulse} />

      <View style={styles.grid}>
        {payload.indexCards.map(card => {
          const d = formatPctDelta(card.pct);
          return (
            <View key={card.code} style={styles.gridCard}>
              <Text style={styles.mutedSm}>{card.code}</Text>
              <Text style={styles.gridValue}>{formatIndexValue(card.value)}</Text>
              <Text style={{color: d.positive ? AYC.positive : AYC.negative, fontWeight: '600'}}>{d.text}</Text>
            </View>
          );
        })}
      </View>

      <Text style={styles.section}>What Drove the Action</Text>
      <BoldParagraph text={payload.narratives.whatDroveAction} />

      <Text style={styles.section}>Volume & Breadth</Text>
      <BoldParagraph text={payload.narratives.volumeBreadth} />
      <View style={styles.grid}>
        {payload.volumeLeaders.map(row => (
          <View key={row.symbol} style={styles.gridCard}>
            <Text style={styles.mutedSm}>{row.symbol}</Text>
            <Text style={styles.gridValue}>{formatInrVolume(row.volume)}</Text>
            <Text style={styles.mutedSm}>{formatInrPrice(row.price)}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.section}>What to Watch Tomorrow</Text>
      <BoldParagraph text={payload.narratives.whatToWatch} />

      <Text style={styles.section}>Fresh Signals</Text>
      <BoldParagraph text={payload.narratives.freshSignals} />
      <View style={styles.grid}>
        {['B1', 'B2', 'B3', 'S1', 'S2', 'S3'].map(tier => (
          <View key={tier} style={styles.gridCard}>
            <Text style={styles.mutedSm}>FRESH {tier} SIGNALS</Text>
            <Text style={styles.gridValue}>{payload.freshSignals[tier]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {paddingBottom: 24},
  headRow: {flexDirection: 'row', gap: 8, alignItems: 'flex-start'},
  eyebrow: {fontSize: 11, letterSpacing: 1, color: AYC.muted, fontWeight: '600'},
  title: {fontSize: 22, fontWeight: '800', color: AYC.text, marginTop: 4},
  meta: {fontSize: 12, color: AYC.muted, marginTop: 2},
  headline: {fontSize: 18, fontWeight: '800', color: AYC.text, marginTop: 16, marginBottom: 8},
  leadBlock: {borderLeftWidth: 4, borderLeftColor: AYC.accent, paddingLeft: 10, marginBottom: 10},
  callout: {backgroundColor: '#eef2f7', borderRadius: 8, padding: 12, marginBottom: 12},
  calloutTxt: {fontSize: 12, color: '#4b5563', lineHeight: 18},
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: AYC.border,
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  cardLabel: {fontSize: 11, letterSpacing: 0.8, fontWeight: '700', color: AYC.muted, marginBottom: 10},
  bar: {flexDirection: 'row', height: 12, borderRadius: 999, overflow: 'hidden', marginBottom: 12},
  barSeg: {height: 12},
  breadthRow: {flexDirection: 'row'},
  breadthCol: {flex: 1},
  mutedSm: {fontSize: 10, color: AYC.muted, fontWeight: '600', letterSpacing: 0.4},
  bigNum: {fontSize: 22, fontWeight: '800', marginTop: 2},
  ratio: {textAlign: 'center', marginTop: 12, fontSize: 13, color: AYC.text},
  pulseRow: {flexDirection: 'row', gap: 12},
  pulseCol: {flex: 1},
  pulseHead: {fontSize: 11, fontWeight: '700', marginBottom: 6},
  pulseLine: {flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4},
  pulseCode: {fontSize: 12, color: AYC.text, flexShrink: 1, paddingRight: 4},
  section: {fontSize: 18, fontWeight: '800', color: AYC.text, marginTop: 16, marginBottom: 8},
  para: {fontSize: 14, lineHeight: 21, color: '#374151', marginBottom: 8},
  bold: {fontWeight: '700', color: AYC.text},
  grid: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8},
  gridCard: {
    width: '31%',
    flexGrow: 1,
    minWidth: 100,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: AYC.border,
    borderRadius: 10,
    padding: 10,
  },
  gridValue: {fontSize: 16, fontWeight: '800', color: AYC.text, marginVertical: 4},
  refreshBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: AYC.border,
    borderRadius: 6,
  },
  refreshTxt: {fontSize: 12, color: AYC.accent},
  error: {color: '#c62828', marginBottom: 8},
});
