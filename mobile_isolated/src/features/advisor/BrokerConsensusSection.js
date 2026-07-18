import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {OptionPicker} from '@components/OptionPicker';
import {advisorService} from '@core/api/services/advisorService';
import {AYC, mobileStyles} from '@core/theme/mobileStyles';
import {
  BROKER_CONSENSUS_CONFIDENCE_OPTIONS,
  BROKER_CONSENSUS_DISCLAIMER,
  BROKER_CONSENSUS_LABEL_OPTIONS,
  BROKER_CONSENSUS_ORIGIN_OPTIONS,
  BROKER_CONSENSUS_PAGE_SIZE,
  BROKER_CONSENSUS_SORT_OPTIONS,
  buildBrokerConsensusQuery,
  formatBrokerConsensusConfidence,
  formatBrokerConsensusCounts,
  formatBrokerConsensusDate,
  formatBrokerConsensusLabel,
  formatBrokerConsensusTarget,
  getBrokerConsensusConfidenceTone,
  getBrokerConsensusLabelTone,
  hasMoreBrokerConsensusPages,
  isNoCoverageItem,
  isSingleSourceView,
  mergeBrokerConsensusPages,
  parseBrokerConsensusListResponse,
} from '@core/utils/brokerConsensusUtils';
import {BrokerConsensusDetailModal} from './BrokerConsensusDetailModal';

const SEARCH_DEBOUNCE_MS = 350;

function FilterChip({label, active, onPress}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active ? styles.chipOn : null]}
      accessibilityRole="button"
      accessibilityState={{selected: active}}>
      <Text style={[styles.chipText, active ? styles.chipTextOn : null]}>{label}</Text>
    </Pressable>
  );
}

function ConsensusCard({item, onPress}) {
  const labelTone = getBrokerConsensusLabelTone(item?.label);
  const confidenceTone = getBrokerConsensusConfidenceTone(item?.confidence);
  const noCoverage = isNoCoverageItem(item);
  const singleSource = isSingleSourceView(item);

  return (
    <Pressable style={styles.card} onPress={() => onPress(item?.symbol)} accessibilityRole="button">
      <View style={styles.cardTop}>
        <View style={{flex: 1}}>
          <Text style={styles.cardSymbol}>{item?.symbol || '—'}</Text>
          {item?.company_name ? (
            <Text style={styles.cardCompany} numberOfLines={1}>
              {item.company_name}
            </Text>
          ) : null}
        </View>
        <View style={[styles.badge, {backgroundColor: labelTone}]}>
          <Text style={styles.badgeTxt}>{formatBrokerConsensusLabel(item?.label)}</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <Text style={[styles.metaPill, {color: confidenceTone}]}>
          {formatBrokerConsensusConfidence(item?.confidence)}
        </Text>
        {noCoverage ? <Text style={styles.flag}>No coverage</Text> : null}
        {singleSource ? <Text style={styles.flag}>Single source</Text> : null}
      </View>

      <Text style={styles.cardLine}>{formatBrokerConsensusCounts(item?.counts)}</Text>
      <Text style={styles.cardLine}>{formatBrokerConsensusTarget(item?.target)}</Text>
      <Text style={styles.cardMuted}>
        Newest call {formatBrokerConsensusDate(item?.newest_call_date)} · Domestic {item?.domestic_count ?? 0} ·
        Foreign {item?.foreign_count ?? 0}
      </Text>
    </Pressable>
  );
}

export function BrokerConsensusSection() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [label, setLabel] = useState('');
  const [origin, setOrigin] = useState('');
  const [confidence, setConfidence] = useState('');
  const [sort, setSort] = useState('score_desc');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [asOf, setAsOf] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [detailSymbol, setDetailSymbol] = useState('');
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [showOriginPicker, setShowOriginPicker] = useState(false);
  const [showConfidencePicker, setShowConfidencePicker] = useState(false);
  const [showSortPicker, setShowSortPicker] = useState(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const filters = useMemo(
    () => ({search, label, origin, confidence, sort}),
    [confidence, label, origin, search, sort],
  );

  const loadPage = useCallback(
    async (pageNum, {append = false} = {}) => {
      const requestId = ++requestIdRef.current;
      const query = buildBrokerConsensusQuery({...filters, page: pageNum});
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError('');
      try {
        const resp = await advisorService.fetchBrokerConsensusList(query);
        if (requestId !== requestIdRef.current) return;
        const parsed = parseBrokerConsensusListResponse(resp);
        setItems(prev => (append ? mergeBrokerConsensusPages(prev, parsed.items) : parsed.items));
        setTotal(parsed.total);
        setPage(parsed.page);
        setAsOf(parsed.as_of);
      } catch (e) {
        if (requestId !== requestIdRef.current) return;
        if (!append) setItems([]);
        setError(String(e?.message || e));
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [filters],
  );

  useEffect(() => {
    setPage(1);
    loadPage(1, {append: false});
  }, [filters, loadPage]);

  const canLoadMore = hasMoreBrokerConsensusPages({page, page_size: BROKER_CONSENSUS_PAGE_SIZE, total});
  const selectedLabel = BROKER_CONSENSUS_LABEL_OPTIONS.find(o => o.id === label)?.label || 'All labels';
  const selectedOrigin = BROKER_CONSENSUS_ORIGIN_OPTIONS.find(o => o.id === origin)?.label || 'All origins';
  const selectedConfidence =
    BROKER_CONSENSUS_CONFIDENCE_OPTIONS.find(o => o.id === confidence)?.label || 'All confidence';
  const selectedSort = BROKER_CONSENSUS_SORT_OPTIONS.find(o => o.id === sort)?.label || 'Score (high to low)';

  return (
    <View style={styles.wrap}>
      <Text style={mobileStyles.subtitle}>Third-party broker research aggregation</Text>
      <Text style={styles.disclaimer}>{BROKER_CONSENSUS_DISCLAIMER}</Text>

      <Text style={styles.fieldLabel}>Search symbol or company</Text>
      <TextInput
        value={searchInput}
        onChangeText={setSearchInput}
        placeholder="Search…"
        autoCapitalize="characters"
        autoCorrect={false}
        style={mobileStyles.input}
        accessibilityLabel="Search broker consensus"
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <FilterChip label={selectedLabel} active={Boolean(label)} onPress={() => setShowLabelPicker(true)} />
        <FilterChip label={selectedOrigin} active={Boolean(origin)} onPress={() => setShowOriginPicker(true)} />
        <FilterChip
          label={selectedConfidence}
          active={Boolean(confidence)}
          onPress={() => setShowConfidencePicker(true)}
        />
        <FilterChip label={selectedSort} active={sort !== 'score_desc'} onPress={() => setShowSortPicker(true)} />
      </ScrollView>

      {asOf ? <Text style={styles.asOf}>As of {formatBrokerConsensusDate(asOf)} · {total} symbols</Text> : null}

      {error ? (
        <View style={styles.errRow}>
          <Text style={styles.err}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => loadPage(page, {append: false})}>
            <Text style={styles.retryTxt}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {loading && !items.length ? (
        <View style={styles.center}>
          <ActivityIndicator color={AYC.accent} />
        </View>
      ) : null}

      {!loading && !error && !items.length ? (
        <Text style={styles.empty}>No broker consensus matches these filters.</Text>
      ) : null}

      {items.map(item => (
        <ConsensusCard key={item.symbol} item={item} onPress={setDetailSymbol} />
      ))}

      {canLoadMore ? (
        <Pressable
          style={[styles.loadMoreBtn, loadingMore ? styles.loadMoreDisabled : null]}
          disabled={loadingMore}
          onPress={() => loadPage(page + 1, {append: true})}>
          <Text style={styles.loadMoreTxt}>{loadingMore ? 'Loading…' : 'Load more'}</Text>
        </Pressable>
      ) : null}

      <BrokerConsensusDetailModal
        visible={Boolean(detailSymbol)}
        symbol={detailSymbol}
        onClose={() => setDetailSymbol('')}
      />

      <OptionPicker
        visible={showLabelPicker}
        title="Consensus label"
        subtitle="Filter by aggregated broker view"
        options={BROKER_CONSENSUS_LABEL_OPTIONS}
        selectedId={label}
        onSelect={setLabel}
        onClose={() => setShowLabelPicker(false)}
      />
      <OptionPicker
        visible={showOriginPicker}
        title="Broker origin"
        subtitle="Domestic or foreign institutions"
        options={BROKER_CONSENSUS_ORIGIN_OPTIONS}
        selectedId={origin}
        onSelect={setOrigin}
        onClose={() => setShowOriginPicker(false)}
      />
      <OptionPicker
        visible={showConfidencePicker}
        title="Confidence"
        subtitle="Coverage strength for the consensus"
        options={BROKER_CONSENSUS_CONFIDENCE_OPTIONS}
        selectedId={confidence}
        onSelect={setConfidence}
        onClose={() => setShowConfidencePicker(false)}
      />
      <OptionPicker
        visible={showSortPicker}
        title="Sort"
        subtitle="Order the consensus list"
        options={BROKER_CONSENSUS_SORT_OPTIONS}
        selectedId={sort}
        onSelect={setSort}
        onClose={() => setShowSortPicker(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {gap: 10},
  disclaimer: {
    fontSize: AYC.type.caption,
    color: AYC.textMuted,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  fieldLabel: mobileStyles.label,
  chipRow: {flexDirection: 'row', gap: 8, paddingVertical: 4},
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: AYC.accent,
    backgroundColor: AYC.card,
    minHeight: 36,
    justifyContent: 'center',
  },
  chipOn: {backgroundColor: AYC.appBar, borderColor: AYC.appBar},
  chipText: {fontSize: AYC.type.caption, fontWeight: '800', color: AYC.accent},
  chipTextOn: {color: '#fff'},
  asOf: {fontSize: AYC.type.caption, color: AYC.textMuted, fontWeight: '700'},
  errRow: {flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap'},
  err: mobileStyles.err,
  retryBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: AYC.negative,
  },
  retryTxt: {color: AYC.negative, fontWeight: '800', fontSize: AYC.type.caption},
  center: {paddingVertical: 24, alignItems: 'center'},
  empty: {paddingVertical: 16, color: AYC.textMuted, textAlign: 'center', fontSize: AYC.type.body},
  card: {
    backgroundColor: AYC.card,
    borderWidth: 1,
    borderColor: AYC.cardBorder,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  cardTop: {flexDirection: 'row', alignItems: 'flex-start', gap: 10},
  cardSymbol: {fontSize: AYC.type.metricSm, fontWeight: '900', color: AYC.text},
  cardCompany: {fontSize: AYC.type.caption, color: AYC.textMuted, fontWeight: '600', marginTop: 2},
  badge: {paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999},
  badgeTxt: {color: '#fff', fontWeight: '800', fontSize: AYC.type.caption},
  metaRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center'},
  metaPill: {fontSize: AYC.type.caption, fontWeight: '800'},
  flag: {fontSize: AYC.type.caption, color: AYC.warning, fontWeight: '800'},
  cardLine: {fontSize: AYC.type.body, color: AYC.text, fontWeight: '700'},
  cardMuted: {fontSize: AYC.type.caption, color: AYC.textMuted, fontWeight: '600'},
  loadMoreBtn: {
    marginTop: 4,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AYC.accent,
    alignItems: 'center',
  },
  loadMoreDisabled: {opacity: 0.6},
  loadMoreTxt: {color: AYC.accent, fontWeight: '800', fontSize: AYC.type.body},
});
