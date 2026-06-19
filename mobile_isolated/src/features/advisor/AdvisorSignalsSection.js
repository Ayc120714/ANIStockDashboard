import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {OptionPicker} from '@components/OptionPicker';
import {TradingViewLink} from '@components/TradingViewLink';
import {ListPagePager} from '@components/ListPagePager';
import {advisorService} from '@core/api/services/advisorService';
import {alertsService} from '@core/api/services/alertsService';
import {MOBILE_ALERTS_LIMIT, MOBILE_TIER_TABLE_PAGE_SIZE} from '@core/utils/advisorWebParity';
import {API_TIMEOUT_MS} from '@core/config/apiTimeouts';
import {extractApiRows} from '@core/utils/apiPayload';
import {isTodayInIST} from '@core/utils/alertInboxUtils';
import {
  isLiveEntryExitAlert,
  isActionableTodaySignalRow,
} from '@core/utils/signalsTabPayload';
import {
  ensureMarketSession,
  getCachedMarketSession,
  getMarketPollingIntervalMs,
  shouldPollLiveMarket,
} from '@core/utils/marketSession';
import {SCREEN_LIVE_POLL_MS} from '@core/utils/screenPageLoader';
import {
  ADVISOR_RECO_OPTIONS,
  ADVISOR_STRATEGY_OPTIONS,
  dedupeAlertsBySymbol,
  dedupeSignalsBySymbol,
  deriveStrategyTags,
  filterAdvisorSignals,
} from '@core/utils/advisorSignalsFilter';
import {
  buildEarlyDetectionTableModel,
  recentLookbackDaysForTimeframe,
} from '@core/utils/earlyDetectionTable';
import {
  EXTRA_SETUPS,
  buildLevelsLookup,
  mapSetupRows,
} from '@core/utils/advisorSetupTables';
import {formatINR} from '@core/utils/formatMarket';
import {safeFetch} from '@core/utils/safeFetch';
import {usePagedList} from '@hooks/usePagedList';
import {AYC} from '@core/theme/mobileStyles';

const PAGE_SIZE = MOBILE_TIER_TABLE_PAGE_SIZE;
const SIGNALS_SETUP_META = EXTRA_SETUPS.filter(s => s.id !== 'other' && s.id !== 'custom_rs');
const ED_TFS = [
  {id: 'daily', label: 'Daily'},
  {id: 'weekly', label: 'Weekly'},
  {id: 'monthly', label: 'Monthly'},
];

function SectionBlock({title, count, children}) {
  return (
    <View style={styles.block}>
      <View style={styles.blockHead}>
        <Text style={styles.blockTitle}>{title}</Text>
        {count != null ? <Text style={styles.blockCount}>{count}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function CompactLevelsTable({title, rows, tone, pageSize = PAGE_SIZE}) {
  const {page, setPage, totalPages, pagedItems, totalItems} = usePagedList(rows || [], {
    pageSize,
    resetDeps: [title, rows?.length],
  });
  if (!rows?.length) return null;
  return (
    <SectionBlock title={title} count={rows.length}>
      <View style={styles.thRow}>
        <Text style={[styles.th, styles.colSym]}>Symbol</Text>
        <Text style={[styles.th, styles.colTv]} />
        <Text style={[styles.th, styles.colLvl]}>SL</Text>
        <Text style={[styles.th, styles.colLvl]}>T1</Text>
        <Text style={[styles.th, styles.colLvl]}>T2</Text>
      </View>
      {pagedItems.map((row, index) => (
        <View
          key={`${title}-${row.symbol}-${index}`}
          style={[
            styles.tr,
            index % 2 === 0 ? styles.trAlt : null,
            tone === 'bull' ? styles.trBull : tone === 'bear' ? styles.trBear : null,
          ]}>
          <Text style={[styles.td, styles.colSym, styles.symBold]} numberOfLines={1}>
            {row.symbol}
          </Text>
          <View style={[styles.td, styles.colTv]}>
            <TradingViewLink symbol={row.symbol} />
          </View>
          <Text style={[styles.td, styles.colLvl]}>{row.stop_loss != null ? formatINR(row.stop_loss) : '—'}</Text>
          <Text style={[styles.td, styles.colLvl]}>{row.target_1 != null ? formatINR(row.target_1) : '—'}</Text>
          <Text style={[styles.td, styles.colLvl]}>{row.target_2 != null ? formatINR(row.target_2) : '—'}</Text>
        </View>
      ))}
      <ListPagePager page={page} totalPages={totalPages} totalItems={totalItems} onPageChange={setPage} />
    </SectionBlock>
  );
}

function LiveSignalsTable({rows, pageSize = PAGE_SIZE}) {
  const {page, setPage, totalPages, pagedItems, totalItems} = usePagedList(rows || [], {
    pageSize,
    resetDeps: [rows?.length],
  });
  if (!rows?.length) {
    return <Text style={styles.empty}>No signals match the current filters.</Text>;
  }
  return (
    <SectionBlock title="Live signals" count={rows.length}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={styles.thRow}>
            <Text style={[styles.th, styles.lsSym]}>Symbol</Text>
            <Text style={[styles.th, styles.lsTv]} />
            <Text style={[styles.th, styles.lsNum]}>Conv</Text>
            <Text style={[styles.th, styles.lsSm]}>Status</Text>
            <Text style={[styles.th, styles.lsSm]}>Tier</Text>
            <Text style={[styles.th, styles.lsSm]}>Trend</Text>
            <Text style={[styles.th, styles.lsStrat]}>Strategies</Text>
            <Text style={[styles.th, styles.lsNum]}>CMP</Text>
            <Text style={[styles.th, styles.lsNum]}>Entry</Text>
            <Text style={[styles.th, styles.lsNum]}>SL</Text>
            <Text style={[styles.th, styles.lsNum]}>T1</Text>
            <Text style={[styles.th, styles.lsNum]}>T2</Text>
          </View>
          {pagedItems.map((row, index) => {
            const tags = deriveStrategyTags(row);
            const hc = row.high_conviction;
            return (
              <View
                key={`${row.symbol}-${index}`}
                style={[
                  styles.tr,
                  index % 2 === 0 ? styles.trAlt : null,
                  hc ? styles.trBull : null,
                  row.status === 'entry_ready' ? styles.trEntry : null,
                ]}>
                <Text style={[styles.td, styles.lsSym, styles.symBold]}>{row.symbol}</Text>
                <View style={[styles.td, styles.lsTv]}>
                  <TradingViewLink symbol={row.symbol} />
                </View>
                <Text style={[styles.td, styles.lsNum]}>{row.conviction_score ?? '—'}</Text>
                <Text style={[styles.td, styles.lsSm]}>{row.status || '—'}</Text>
                <Text style={[styles.td, styles.lsSm]}>{row.buy_sell_tier || '—'}</Text>
                <Text style={[styles.td, styles.lsSm]} numberOfLines={1}>
                  {row.trend || '—'}
                </Text>
                <Text style={[styles.td, styles.lsStrat]} numberOfLines={2}>
                  {tags.join(' · ') || '—'}
                </Text>
                <Text style={[styles.td, styles.lsNum]}>{row.cmp != null ? formatINR(row.cmp) : '—'}</Text>
                <Text style={[styles.td, styles.lsNum]}>
                  {row.entry_price != null ? formatINR(row.entry_price) : '—'}
                </Text>
                <Text style={[styles.td, styles.lsNum]}>{row.stop_loss != null ? formatINR(row.stop_loss) : '—'}</Text>
                <Text style={[styles.td, styles.lsNum]}>{row.target_1 != null ? formatINR(row.target_1) : '—'}</Text>
                <Text style={[styles.td, styles.lsNum]}>{row.target_2 != null ? formatINR(row.target_2) : '—'}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
      <ListPagePager page={page} totalPages={totalPages} totalItems={totalItems} onPageChange={setPage} />
    </SectionBlock>
  );
}

function CustomRsTable({rows, signalBySymbol, pageSize = PAGE_SIZE}) {
  const enriched = useMemo(() => {
    const deduped = dedupeSignalsBySymbol(rows || []);
    return deduped.map(row => {
        const sym = String(row?.symbol || '').toUpperCase();
        const sig = signalBySymbol.get(sym);
        return {
          ...row,
          conviction: sig?.conviction_score ?? row?.conviction_score,
          status: sig?.status ?? row?.status,
          tier: sig?.buy_sell_tier ?? row?.buy_sell_tier,
        };
      });
  }, [rows, signalBySymbol]);
  const {page, setPage, totalPages, pagedItems, totalItems} = usePagedList(enriched, {
    pageSize,
    resetDeps: [enriched.length],
  });
  if (!enriched.length) return null;
  return (
    <SectionBlock title="Custom RS / MACD / PSAR screen" count={enriched.length}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={styles.thRow}>
            <Text style={[styles.th, styles.lsSym]}>Symbol</Text>
            <Text style={[styles.th, styles.lsTv]} />
            <Text style={[styles.th, styles.lsNum]}>RS D</Text>
            <Text style={[styles.th, styles.lsNum]}>RS W</Text>
            <Text style={[styles.th, styles.lsNum]}>RS M</Text>
            <Text style={[styles.th, styles.lsNum]}>RVOL</Text>
            <Text style={[styles.th, styles.lsNum]}>Conv</Text>
            <Text style={[styles.th, styles.lsSm]}>Status</Text>
            <Text style={[styles.th, styles.lsSm]}>Tier</Text>
          </View>
          {pagedItems.map((row, index) => (
            <View key={`custom-${row.symbol}-${index}`} style={[styles.tr, index % 2 === 0 ? styles.trAlt : null]}>
              <Text style={[styles.td, styles.lsSym, styles.symBold]}>{row.symbol}</Text>
              <View style={[styles.td, styles.lsTv]}>
                <TradingViewLink symbol={row.symbol} />
              </View>
              <Text style={[styles.td, styles.lsNum]}>{row.rs_daily ?? row.rs_daily_123 ?? '—'}</Text>
              <Text style={[styles.td, styles.lsNum]}>{row.rs_weekly ?? row.rs_weekly_52 ?? '—'}</Text>
              <Text style={[styles.td, styles.lsNum]}>{row.rs_monthly ?? row.rs_monthly_11 ?? '—'}</Text>
              <Text style={[styles.td, styles.lsNum]}>{row.rvol ?? row.relative_volume ?? '—'}</Text>
              <Text style={[styles.td, styles.lsNum]}>{row.conviction ?? '—'}</Text>
              <Text style={[styles.td, styles.lsSm]}>{row.status || '—'}</Text>
              <Text style={[styles.td, styles.lsSm]}>{row.tier || '—'}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      <ListPagePager page={page} totalPages={totalPages} totalItems={totalItems} onPageChange={setPage} />
    </SectionBlock>
  );
}

function EarlyDetectionTable({rows, pageSize = PAGE_SIZE}) {
  const {page, setPage, totalPages, pagedItems, totalItems} = usePagedList(rows || [], {
    pageSize,
    resetDeps: [rows?.length],
  });
  if (!rows?.length) return null;
  return (
    <SectionBlock title="Early detection" count={rows.length}>
      <View style={styles.thRow}>
        <Text style={[styles.th, styles.edRank]}>#</Text>
        <Text style={[styles.th, styles.edPhase]}>Phase</Text>
        <Text style={[styles.th, styles.colSym]}>Symbol</Text>
        <Text style={[styles.th, styles.colTv]} />
        <Text style={[styles.th, styles.edSm]}>Sector</Text>
        <Text style={[styles.th, styles.edSm]}>Trigger</Text>
        <Text style={[styles.th, styles.edSm]}>Status</Text>
        <Text style={[styles.th, styles.edNum]}>RVOL</Text>
        <Text style={[styles.th, styles.edSm]}>SQZ</Text>
        <Text style={[styles.th, styles.edNum]}>Close</Text>
      </View>
      {pagedItems.map((row, index) => (
        <View key={`ed-${row.symbol}-${index}`} style={[styles.tr, index % 2 === 0 ? styles.trAlt : null]}>
          <Text style={[styles.td, styles.edRank, styles.symBold]}>{row.wealth_rank ?? row.rank ?? '—'}</Text>
          <Text style={[styles.td, styles.edPhase]} numberOfLines={1}>
            {row.wealth_phase_label || '—'}
            {row.buy_tier ? ` ${row.buy_tier}` : ''}
          </Text>
          <Text style={[styles.td, styles.colSym, styles.symBold]}>{row.symbol}</Text>
          <View style={[styles.td, styles.colTv]}>
            <TradingViewLink symbol={row.symbol} />
          </View>
          <Text style={[styles.td, styles.edSm]} numberOfLines={1}>
            {row.sector || '—'}
          </Text>
          <Text style={[styles.td, styles.edSm]}>{row.trigger_date || '—'}</Text>
          <Text style={[styles.td, styles.edSm]}>{row.status_label || row.status || '—'}</Text>
          <Text style={[styles.td, styles.edNum]}>{row.rvol ?? '—'}</Text>
          <Text style={[styles.td, styles.edSm]}>{row.sqz_set || '—'}</Text>
          <Text style={[styles.td, styles.edNum]}>{row.close != null ? formatINR(row.close) : '—'}</Text>
        </View>
      ))}
      <ListPagePager page={page} totalPages={totalPages} totalItems={totalItems} onPageChange={setPage} />
    </SectionBlock>
  );
}

function AlertsTable({rows}) {
  const {page, setPage, totalPages, pagedItems, totalItems} = usePagedList(rows || [], {
    pageSize: PAGE_SIZE,
    resetDeps: [rows?.length],
  });
  if (!rows?.length) return <Text style={styles.empty}>No advisor alerts right now.</Text>;
  return (
    <SectionBlock title="Advisor alerts" count={rows.length}>
      <View style={styles.thRow}>
        <Text style={[styles.th, styles.edSm]}>Time</Text>
        <Text style={[styles.th, styles.colSym]}>Symbol</Text>
        <Text style={[styles.th, styles.colLvl]}>Entry</Text>
        <Text style={[styles.th, styles.colLvl]}>SL</Text>
        <Text style={[styles.th, styles.colLvl]}>T1</Text>
        <Text style={[styles.th, styles.colLvl]}>Score</Text>
      </View>
      {pagedItems.map((row, index) => (
        <View
          key={`alert-${row.id || row.symbol}-${index}`}
          style={[styles.tr, index % 2 === 0 ? styles.trAlt : null, !row.is_read ? styles.trUnread : null]}>
          <Text style={[styles.td, styles.edSm]} numberOfLines={1}>
            {String(row.timestamp || row.created_at || '').slice(0, 16)}
          </Text>
          <Text style={[styles.td, styles.colSym, styles.symBold]}>{row.symbol}</Text>
          <Text style={[styles.td, styles.colLvl]}>{row.entry_price != null ? formatINR(row.entry_price) : '—'}</Text>
          <Text style={[styles.td, styles.colLvl]}>{row.stop_loss != null ? formatINR(row.stop_loss) : '—'}</Text>
          <Text style={[styles.td, styles.colLvl]}>{row.target_1 != null ? formatINR(row.target_1) : '—'}</Text>
          <Text style={[styles.td, styles.colLvl]}>{row.signal_score ?? '—'}</Text>
        </View>
      ))}
      <ListPagePager page={page} totalPages={totalPages} totalItems={totalItems} onPageChange={setPage} />
    </SectionBlock>
  );
}

export function AdvisorSignalsSection({
  sigRows = [],
  monthlyRows = [],
  customRows = [],
  mondayRows = [],
  loading = false,
  cacheHydrated = false,
}) {
  const [subView, setSubView] = useState('signals');
  const [strategyFilter, setStrategyFilter] = useState('all');
  const [recoFilter, setRecoFilter] = useState('all');
  const [convFilter, setConvFilter] = useState('all');
  const [customSetupMode, setCustomSetupMode] = useState('or_signal');
  const [showStrategyPicker, setShowStrategyPicker] = useState(false);
  const [showRecoPicker, setShowRecoPicker] = useState(false);
  const [showModePicker, setShowModePicker] = useState(false);
  const [edTf, setEdTf] = useState('weekly');
  const [customRowsLocal, setCustomRowsLocal] = useState(customRows);
  const [earlyRows, setEarlyRows] = useState([]);
  const [alertRows, setAlertRows] = useState([]);
  const [edLoading, setEdLoading] = useState(false);
  const [alertsLoading, setAlertsLoading] = useState(false);

  useEffect(() => {
    setCustomRowsLocal(customRows);
  }, [customRows]);

  const levelsBySymbol = useMemo(() => buildLevelsLookup(sigRows), [sigRows]);
  const signalBySymbol = useMemo(() => {
    const map = new Map();
    for (const row of sigRows || []) {
      const sym = String(row?.symbol || '').toUpperCase();
      if (sym && !map.has(sym)) map.set(sym, row);
    }
    return map;
  }, [sigRows]);

  const filteredLive = useMemo(
    () =>
      filterAdvisorSignals(sigRows, monthlyRows, {strategyFilter, recoFilter, convFilter}).filter(
        isActionableTodaySignalRow,
      ),
    [sigRows, monthlyRows, strategyFilter, recoFilter, convFilter],
  );

  const onStrategySelect = useCallback(id => {
    setStrategyFilter(id);
    if (id === 'custom_rs_or_signal') setCustomSetupMode('or_signal');
    if (id === 'custom_rs_strict') setCustomSetupMode('strict');
  }, []);

  const extraGrouped = useMemo(
    () => ({
      monthly_setup: mapSetupRows(monthlyRows, levelsBySymbol),
      custom_rs: mapSetupRows(customRowsLocal, levelsBySymbol),
      monday_pwh: mapSetupRows(mondayRows, levelsBySymbol),
    }),
    [customRowsLocal, levelsBySymbol, mondayRows, monthlyRows],
  );

  const loadEarlyDetection = useCallback(async () => {
    setEdLoading(true);
    try {
      const res = await safeFetch(
        () =>
          advisorService.fetchEarlyDetectionRecent({
            timeframe: edTf,
            lookback_days: recentLookbackDaysForTimeframe(edTf),
            limit: 300,
            dedupe_symbol: true,
          }),
        {label: 'Early detection', timeoutMs: API_TIMEOUT_MS.advisor, retries: 1},
      );
      const raw = extractApiRows(res, ['data', 'rows']);
      const model = buildEarlyDetectionTableModel(raw, {
        sqzFilter: 'all',
        sortCol: 'wealth_rank',
        sortDir: 'desc',
      });
      setEarlyRows(model.sorted);
    } catch {
      setEarlyRows([]);
    } finally {
      setEdLoading(false);
    }
  }, [edTf]);

  const loadCustomSetup = useCallback(async () => {
    try {
      const res = await advisorService.fetchCustomRsMacdSetup({
        limit: 500,
        setup_mode: customSetupMode,
        refresh: true,
      });
      setCustomRowsLocal(dedupeSignalsBySymbol(Array.isArray(res) ? res : extractApiRows(res)));
    } catch {
      /* keep cached rows */
    }
  }, [customSetupMode]);

  const loadAlerts = useCallback(async () => {
    setAlertsLoading(true);
    try {
      const res = await alertsService.fetchLiveAdvisorAlerts({limit: MOBILE_ALERTS_LIMIT});
      const raw = Array.isArray(res) ? res : extractApiRows(res);
      const todayEntryExit = raw.filter(row => {
        if (!isTodayInIST(row?.timestamp || row?.created_at || row?.alert_time)) return false;
        return isLiveEntryExitAlert(row) || String(row?.source || '').toLowerCase() === 'demo';
      });
      setAlertRows(dedupeAlertsBySymbol(todayEntryExit));
    } catch {
      setAlertRows([]);
    } finally {
      setAlertsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (subView === 'signals') {
      loadEarlyDetection();
      return undefined;
    }
    loadAlerts();
    let pollId;
    void (async () => {
      await ensureMarketSession();
      const pollMs = getMarketPollingIntervalMs(SCREEN_LIVE_POLL_MS, 0);
      if (pollMs <= 0) return;
      pollId = setInterval(() => {
        if (!shouldPollLiveMarket(getCachedMarketSession())) return;
        loadAlerts();
      }, pollMs);
    })();
    return () => {
      if (pollId) clearInterval(pollId);
    };
  }, [subView, loadEarlyDetection, loadAlerts]);

  useEffect(() => {
    loadCustomSetup();
  }, [customSetupMode, loadCustomSetup]);

  const strategyLabel =
    ADVISOR_STRATEGY_OPTIONS.find(o => o.id === strategyFilter)?.label || 'All Strategies';
  const recoLabel = ADVISOR_RECO_OPTIONS.find(o => o.id === recoFilter)?.label || 'All Reco';

  return (
    <View style={styles.root}>
      <View style={styles.subTabs}>
        <Pressable
          style={[styles.subTab, subView === 'signals' ? styles.subTabOn : null]}
          onPress={() => setSubView('signals')}>
          <Text style={[styles.subTabText, subView === 'signals' ? styles.subTabTextOn : null]}>
            Signals ({filteredLive.length})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.subTab, subView === 'alerts' ? styles.subTabOn : null]}
          onPress={() => setSubView('alerts')}>
          <Text style={[styles.subTabText, subView === 'alerts' ? styles.subTabTextOn : null]}>
            Alerts ({alertRows.length})
          </Text>
        </Pressable>
      </View>

      {subView === 'signals' ? (
        <>
          <View style={styles.filters}>
            <Pressable style={styles.filterBtn} onPress={() => setShowRecoPicker(true)}>
              <Text style={styles.filterBtnText} numberOfLines={1}>
                {recoLabel}
              </Text>
            </Pressable>
            <Pressable style={[styles.filterBtn, styles.filterBtnWide]} onPress={() => setShowStrategyPicker(true)}>
              <Text style={styles.filterBtnText} numberOfLines={1}>
                {strategyLabel}
              </Text>
            </Pressable>
          </View>
          <View style={styles.convRow}>
            <Pressable
              style={[styles.convChip, convFilter === 'all' ? styles.convChipOn : null]}
              onPress={() => setConvFilter('all')}>
              <Text style={[styles.convChipText, convFilter === 'all' ? styles.convChipTextOn : null]}>All</Text>
            </Pressable>
            <Pressable
              style={[styles.convChip, convFilter === 'high' ? styles.convChipOn : null]}
              onPress={() => setConvFilter('high')}>
              <Text style={[styles.convChipText, convFilter === 'high' ? styles.convChipTextOn : null]}>High</Text>
            </Pressable>
          </View>

          {loading && !sigRows.length ? <ActivityIndicator color={AYC.accent} style={styles.spinner} /> : null}

          <LiveSignalsTable rows={filteredLive} />

          <View style={styles.edTfRow}>
            {ED_TFS.map(tf => (
              <Pressable
                key={tf.id}
                onPress={() => setEdTf(tf.id)}
                style={[styles.miniChip, edTf === tf.id ? styles.miniChipOn : null]}>
                <Text style={[styles.miniChipText, edTf === tf.id ? styles.miniChipTextOn : null]}>{tf.label}</Text>
              </Pressable>
            ))}
          </View>
          {edLoading ? <ActivityIndicator color={AYC.accent} /> : <EarlyDetectionTable rows={earlyRows} />}

          <View style={styles.customHead}>
            <Pressable style={styles.filterBtn} onPress={() => setShowModePicker(true)}>
              <Text style={styles.filterBtnText}>{customSetupMode}</Text>
            </Pressable>
            <Pressable style={styles.refreshLink} onPress={loadCustomSetup}>
              <Text style={styles.refreshLinkText}>Refresh</Text>
            </Pressable>
          </View>
          <CustomRsTable rows={customRowsLocal} signalBySymbol={signalBySymbol} />

          {SIGNALS_SETUP_META.map(setup => (
            <CompactLevelsTable
              key={setup.id}
              title={setup.label}
              rows={extraGrouped[setup.id] || []}
            />
          ))}

          {cacheHydrated && !loading && !filteredLive.length && !earlyRows.length && !customRowsLocal.length ? (
            <Text style={styles.empty}>No advisor signals loaded yet. Pull down to refresh.</Text>
          ) : null}
        </>
      ) : (
        <>
          {alertsLoading ? <ActivityIndicator color={AYC.accent} style={styles.spinner} /> : null}
          <AlertsTable rows={alertRows} />
        </>
      )}

      <OptionPicker
        visible={showStrategyPicker}
        title="Strategy filter"
        options={ADVISOR_STRATEGY_OPTIONS}
        selectedId={strategyFilter}
        onSelect={onStrategySelect}
        onClose={() => setShowStrategyPicker(false)}
      />
      <OptionPicker
        visible={showRecoPicker}
        title="Recommendation"
        options={ADVISOR_RECO_OPTIONS}
        selectedId={recoFilter}
        onSelect={setRecoFilter}
        onClose={() => setShowRecoPicker(false)}
      />
      <OptionPicker
        visible={showModePicker}
        title="Custom RS mode"
        options={[
          {id: 'or_signal', label: 'or_signal'},
          {id: 'strict', label: 'strict'},
        ]}
        selectedId={customSetupMode}
        onSelect={setCustomSetupMode}
        onClose={() => setShowModePicker(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {gap: 8},
  subTabs: {flexDirection: 'row', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, overflow: 'hidden'},
  subTab: {flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: '#fff'},
  subTabOn: {backgroundColor: AYC.appBar},
  subTabText: {fontSize: 12, fontWeight: '600', color: AYC.text},
  subTabTextOn: {color: '#fff', fontWeight: '800'},
  filters: {flexDirection: 'row', gap: 8, flexWrap: 'wrap'},
  convRow: {flexDirection: 'row', gap: 8, marginTop: 4},
  convChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  convChipOn: {backgroundColor: AYC.appBar, borderColor: AYC.appBar},
  convChipText: {fontSize: 11, fontWeight: '700', color: AYC.text},
  convChipTextOn: {color: '#fff'},
  filterBtn: {
    flex: 1,
    minWidth: 120,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  filterBtnWide: {flex: 2, minWidth: 180},
  filterBtnText: {fontSize: 11, fontWeight: '700', color: AYC.text},
  block: {marginTop: 8},
  blockHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: AYC.appBar,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 4,
  },
  blockTitle: {fontSize: 13, fontWeight: '800', color: '#fff', flex: 1},
  blockCount: {fontSize: 12, fontWeight: '800', color: '#e2e8f0'},
  thRow: {flexDirection: 'row', alignItems: 'center', paddingVertical: 4, borderBottomWidth: 1, borderColor: '#e5e7eb'},
  th: {fontSize: 10, fontWeight: '800', color: AYC.textMuted},
  td: {fontSize: 11, color: AYC.text},
  tr: {flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#f1f5f9'},
  trAlt: {backgroundColor: '#fafafa'},
  trBull: {backgroundColor: '#f0fdf4'},
  trBear: {backgroundColor: '#fef2f2'},
  trEntry: {borderLeftWidth: 3, borderLeftColor: '#2563eb'},
  trUnread: {backgroundColor: '#fffde7'},
  symBold: {fontWeight: '800'},
  colSym: {flex: 1, minWidth: 64},
  colTv: {width: 28, alignItems: 'center'},
  colLvl: {flex: 1, minWidth: 68},
  lsSym: {width: 72},
  lsTv: {width: 28, alignItems: 'center'},
  lsNum: {width: 64, textAlign: 'right'},
  lsSm: {width: 56},
  lsStrat: {width: 120},
  edRank: {width: 28, textAlign: 'center'},
  edPhase: {width: 80},
  edSm: {width: 72},
  edNum: {width: 56, textAlign: 'right'},
  edTfRow: {flexDirection: 'row', gap: 8, marginTop: 4},
  miniChip: {paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: AYC.accent},
  miniChipOn: {backgroundColor: AYC.appBar, borderColor: AYC.appBar},
  miniChipText: {fontSize: 11, fontWeight: '700', color: AYC.accent},
  miniChipTextOn: {color: '#fff'},
  customHead: {flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4},
  refreshLink: {paddingVertical: 6},
  refreshLinkText: {fontSize: 12, fontWeight: '700', color: AYC.accent},
  empty: {paddingVertical: 16, color: AYC.textMuted, textAlign: 'center', fontSize: AYC.type.body},
  spinner: {marginVertical: 12},
});
