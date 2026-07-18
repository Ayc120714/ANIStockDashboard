import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {advisorService} from '@core/api/services/advisorService';
import {AYC, mobileStyles} from '@core/theme/mobileStyles';
import {formatINR} from '@core/utils/formatMarket';
import {
  BROKER_CONSENSUS_DISCLAIMER,
  formatBrokerConsensusConfidence,
  formatBrokerConsensusCounts,
  formatBrokerConsensusDate,
  formatBrokerConsensusLabel,
  formatBrokerConsensusOrigin,
  formatBrokerConsensusScore,
  formatBrokerConsensusTarget,
  getBrokerConsensusConfidenceTone,
  getBrokerConsensusLabelTone,
  isNoCoverageItem,
  isSingleSourceView,
  openExternalHttpUrl,
  parseBrokerConsensusDetailResponse,
} from '@core/utils/brokerConsensusUtils';
import {resolveBottomInset} from '@core/utils/safeAreaTop';

function FactRow({label, value}) {
  return (
    <View style={styles.factRow}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

function RecommendationCard({rec, onOpenSource}) {
  const target =
    rec?.target_price != null && !Number.isNaN(Number(rec.target_price))
      ? `${formatINR(rec.target_price)}${rec.currency ? ` ${rec.currency}` : ''}`
      : '—';
  const hasUrl = Boolean(String(rec?.source_url || '').trim());

  return (
    <View style={styles.recCard}>
      <View style={styles.recHead}>
        <Text style={styles.recInstitution}>{rec?.institution_name || 'Unknown institution'}</Text>
        <Text style={styles.recOrigin}>{formatBrokerConsensusOrigin(rec?.origin)}</Text>
      </View>
      <FactRow
        label="Rating"
        value={`${rec?.original_rating || '—'} → ${formatBrokerConsensusLabel(rec?.normalized_rating)}`}
      />
      <FactRow label="Target" value={target} />
      <FactRow label="Call date" value={formatBrokerConsensusDate(rec?.recommendation_date)} />
      <FactRow label="Published" value={formatBrokerConsensusDate(rec?.published_at)} />
      <FactRow label="Source tier" value={rec?.source_tier || '—'} />
      <FactRow label="SEBI verified" value={rec?.sebi_verified ? 'Yes' : 'No'} />
      <FactRow label="Parser confidence" value={rec?.parser_confidence || '—'} />
      {hasUrl ? (
        <Pressable
          style={styles.sourceBtn}
          accessibilityRole="link"
          accessibilityLabel={`Open source for ${rec?.institution_name || 'institution'}`}
          onPress={() => onOpenSource(rec.source_url)}>
          <Text style={styles.sourceBtnTxt}>View source attribution</Text>
        </Pressable>
      ) : (
        <Text style={styles.sourceMissing}>Source link unavailable</Text>
      )}
    </View>
  );
}

export function BrokerConsensusDetailModal({visible, symbol, onClose}) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState(null);

  const load = useCallback(async () => {
    const sym = String(symbol || '').trim().toUpperCase();
    if (!sym) return;
    setLoading(true);
    setError('');
    try {
      const resp = await advisorService.fetchBrokerConsensusDetail(sym);
      setDetail(parseBrokerConsensusDetailResponse(resp));
    } catch (e) {
      setDetail(null);
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    if (visible && symbol) {
      load();
    } else if (!visible) {
      setDetail(null);
      setError('');
    }
  }, [visible, symbol, load]);

  const summary = detail?.summary;
  const recommendations = detail?.recommendations || [];
  const labelTone = getBrokerConsensusLabelTone(summary?.label);
  const confidenceTone = getBrokerConsensusConfidenceTone(summary?.confidence);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, {paddingTop: insets.top, paddingBottom: resolveBottomInset(insets)}]}>
        <View style={styles.header}>
          <View style={{flex: 1}}>
            <Text style={styles.title}>{symbol || 'Broker consensus'}</Text>
            {summary?.company_name ? <Text style={styles.sub}>{summary.company_name}</Text> : null}
          </View>
          <Pressable onPress={onClose} style={styles.closeBtn} accessibilityRole="button">
            <Text style={styles.closeTxt}>Close</Text>
          </Pressable>
        </View>

        {loading && !summary ? (
          <View style={styles.center}>
            <ActivityIndicator color={AYC.accent} />
          </View>
        ) : null}

        {error ? (
          <View style={styles.errBox}>
            <Text style={styles.err}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={load}>
              <Text style={styles.retryTxt}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && !error && summary ? (
          <ScrollView contentContainerStyle={styles.body}>
            <Text style={styles.disclaimer}>{BROKER_CONSENSUS_DISCLAIMER}</Text>

            <View style={styles.summaryCard}>
              <View style={styles.badgeRow}>
                <View style={[styles.badge, {backgroundColor: labelTone}]}>
                  <Text style={styles.badgeTxt}>{formatBrokerConsensusLabel(summary.label)}</Text>
                </View>
                <View style={[styles.badge, styles.badgeOutline, {borderColor: confidenceTone}]}>
                  <Text style={[styles.badgeOutlineTxt, {color: confidenceTone}]}>
                    {formatBrokerConsensusConfidence(summary.confidence)}
                  </Text>
                </View>
              </View>
              {isNoCoverageItem(summary) ? (
                <Text style={styles.callout}>No coverage — no active broker calls for this symbol.</Text>
              ) : null}
              {isSingleSourceView(summary) ? (
                <Text style={styles.callout}>Single-source view — based on one active broker call.</Text>
              ) : null}
              <FactRow label="Score" value={formatBrokerConsensusScore(summary.score)} />
              <FactRow label="Vote mix" value={formatBrokerConsensusCounts(summary.counts)} />
              <FactRow label="Target" value={formatBrokerConsensusTarget(summary.target)} />
              <FactRow label="Newest call" value={formatBrokerConsensusDate(summary.newest_call_date)} />
              <FactRow
                label="Origins"
                value={`Domestic ${summary.domestic_count ?? 0} · Foreign ${summary.foreign_count ?? 0}`}
              />
            </View>

            <Text style={styles.sectionTitle}>Institution calls</Text>
            {!recommendations.length ? (
              <Text style={styles.empty}>No active institution recommendations to show.</Text>
            ) : (
              recommendations.map((rec, index) => (
                <RecommendationCard
                  key={`${rec.institution_name}-${index}`}
                  rec={rec}
                  onOpenSource={openExternalHttpUrl}
                />
              ))
            )}
          </ScrollView>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: AYC.pageBg},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: AYC.cardBorder,
    gap: 12,
  },
  title: mobileStyles.pageTitle,
  sub: mobileStyles.subtitle,
  closeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: AYC.accent,
  },
  closeTxt: {color: AYC.accent, fontWeight: '800', fontSize: AYC.type.body},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  body: {padding: 16, gap: 12},
  disclaimer: {
    fontSize: AYC.type.caption,
    color: AYC.textMuted,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  summaryCard: {
    backgroundColor: AYC.card,
    borderWidth: 1,
    borderColor: AYC.cardBorder,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  badgeRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  badge: {paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999},
  badgeTxt: {color: '#fff', fontWeight: '800', fontSize: AYC.type.caption},
  badgeOutline: {backgroundColor: 'transparent', borderWidth: 1},
  badgeOutlineTxt: {fontWeight: '800', fontSize: AYC.type.caption},
  callout: {
    fontSize: AYC.type.caption,
    color: AYC.warning,
    fontWeight: '700',
    lineHeight: 16,
  },
  sectionTitle: mobileStyles.sectionTitle,
  recCard: {
    backgroundColor: AYC.card,
    borderWidth: 1,
    borderColor: AYC.cardBorder,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  recHead: {flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start'},
  recInstitution: {flex: 1, fontSize: AYC.type.body, fontWeight: '800', color: AYC.text},
  recOrigin: {fontSize: AYC.type.caption, color: AYC.textMuted, fontWeight: '700'},
  factRow: {flexDirection: 'row', justifyContent: 'space-between', gap: 12},
  factLabel: {fontSize: AYC.type.caption, color: AYC.textMuted, fontWeight: '700', flex: 0.9},
  factValue: {
    fontSize: AYC.type.caption,
    color: AYC.text,
    fontWeight: '700',
    flex: 1.1,
    textAlign: 'right',
  },
  sourceBtn: {
    marginTop: 4,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: AYC.accent,
    alignItems: 'center',
  },
  sourceBtnTxt: {color: AYC.accent, fontWeight: '800', fontSize: AYC.type.body},
  sourceMissing: {fontSize: AYC.type.caption, color: AYC.textMuted, fontStyle: 'italic', marginTop: 4},
  empty: {fontSize: AYC.type.body, color: AYC.textMuted, textAlign: 'center', paddingVertical: 12},
  errBox: {padding: 16, gap: 8},
  err: mobileStyles.err,
  retryBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: AYC.negative,
  },
  retryTxt: {color: AYC.negative, fontWeight: '800', fontSize: AYC.type.caption},
});
