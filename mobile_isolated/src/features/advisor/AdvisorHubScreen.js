import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {MobileChrome} from '@components/mobileChrome/MobileChrome';
import {TradingViewLink} from '@components/TradingViewLink';
import {SortableTableHeader} from '@components/SortableTableHeader';
import {mobilePad, mobileStyles, AYC} from '@core/theme/mobileStyles';
import {signalsService} from '@core/api/services/signalsService';
import {advisorService} from '@core/api/services/advisorService';
import {readAdvisorSignalsCache, writeAdvisorSignalsCache} from '@core/storage/advisorSignalsCache';
import {extractApiRows} from '@core/utils/apiPayload';
import {
  EXTRA_SETUPS,
  TIER_SETUPS,
  buildLevelsLookup,
  groupLatestSignalsByTier,
  mapSetupRows,
} from '@core/utils/advisorSetupTables';
import {
  buildChartFundamentalBlocks,
  formatChartCell,
} from '@core/utils/chartFundamentalTables';
import {formatINR} from '@core/utils/formatMarket';
import {sortRows} from '@core/utils/tableSort';
import {getAdvisorSortValue} from '@core/utils/screenSortValues';
import {useTableSort} from '@hooks/useTableSort';

const TABS = [
  {id: 'sig', label: 'Signals & alerts'},
  {id: 'trend', label: 'Trend reversal'},
  {id: 'chart', label: 'Chart & fundamental'},
  {id: 'ai', label: 'AI analysis'},
  {id: 'health', label: 'Portfolio health'},
];

const SETUP_META = [...TIER_SETUPS, ...EXTRA_SETUPS.filter(s => s.id !== 'other')];

function SetupLevelsTable({title, rows, enabled, tone}) {
  if (!rows?.length) return null;
  return (
    <View style={styles.setupBlock}>
      <View style={[styles.setupTitleWrap, enabled ? styles.setupTitleOn : styles.setupTitleOff]}>
        <Text style={[styles.setupTitle, enabled ? styles.setupTitleTextOn : null]}>{title}</Text>
        <Text style={[styles.setupCount, enabled ? styles.setupTitleTextOn : null]}>{rows.length}</Text>
      </View>
      <View style={styles.thRow}>
        <Text style={[styles.th, styles.colSym]}>Symbol</Text>
        <Text style={[styles.th, styles.colTv]} />
        <Text style={[styles.th, styles.colLvl]}>SL</Text>
        <Text style={[styles.th, styles.colLvl]}>T1</Text>
        <Text style={[styles.th, styles.colLvl]}>T2</Text>
      </View>
      {rows.map((row, index) => (
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
    </View>
  );
}

function ChartFundamentalTable({block}) {
  const hasPrev = Boolean(block.prevHeader);
  return (
    <View style={styles.setupBlock}>
      <View style={[styles.setupTitleWrap, block.rows.length ? styles.setupTitleOn : styles.setupTitleOff]}>
        <Text style={[styles.setupTitle, block.rows.length ? styles.setupTitleTextOn : null]}>{block.title}</Text>
        <Text style={[styles.setupCount, block.rows.length ? styles.setupTitleTextOn : null]}>{block.matchCount}</Text>
      </View>
      <Text style={styles.chartHint}>
        {block.matchCount} matches · scanned {block.scanned} symbols
      </Text>
      {block.rows.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <View style={styles.thRow}>
              <Text style={[styles.th, styles.cfSym]}>Symbol</Text>
              <Text style={[styles.th, styles.cfTv]} />
              <Text style={[styles.th, styles.cfSector]}>Sector</Text>
              <Text style={[styles.th, styles.cfNum]}>{block.closeHeader}</Text>
              {hasPrev ? <Text style={[styles.th, styles.cfNum]}>{block.prevHeader}</Text> : null}
              <Text style={[styles.th, styles.cfRs]}>{block.rsHeader}</Text>
              <Text style={[styles.th, styles.cfDi]}>DI+</Text>
              <Text style={[styles.th, styles.cfRating]}>Rating</Text>
              <Text style={[styles.th, styles.cfHorizon]}>Horizon</Text>
            </View>
            {block.rows.map((row, index) => (
              <View key={`${block.id}-${row.symbol}-${index}`} style={[styles.tr, index % 2 === 0 ? styles.trAlt : null]}>
                <Text style={[styles.td, styles.cfSym, styles.symBold]} numberOfLines={1}>
                  {row.symbol}
                </Text>
                <View style={[styles.td, styles.cfTv]}>
                  <TradingViewLink symbol={row.symbol} />
                </View>
                <Text style={[styles.td, styles.cfSector]} numberOfLines={1}>
                  {row.sector}
                </Text>
                <Text style={[styles.td, styles.cfNum]}>{formatChartCell(row, 'close')}</Text>
                {hasPrev ? <Text style={[styles.td, styles.cfNum]}>{formatChartCell(row, 'prevClose')}</Text> : null}
                <Text style={[styles.td, styles.cfRs, styles.rsPos]}>{formatChartCell(row, 'rs')}</Text>
                <Text style={[styles.td, styles.cfDi]}>{formatChartCell(row, 'diPlus')}</Text>
                <Text style={[styles.td, styles.cfRating]} numberOfLines={1}>
                  {row.rating}
                </Text>
                <Text style={[styles.td, styles.cfHorizon]} numberOfLines={1}>
                  {row.horizon}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>
      ) : (
        <Text style={styles.empty}>No symbols match this setup.</Text>
      )}
    </View>
  );
}

export function AdvisorHubScreen({navigation}) {
  const [tab, setTab] = useState('sig');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [sigRows, setSigRows] = useState([]);
  const [monthlyRows, setMonthlyRows] = useState([]);
  const [customRows, setCustomRows] = useState([]);
  const [mondayRows, setMondayRows] = useState([]);
  const [enabledSetups, setEnabledSetups] = useState(() => new Set(SETUP_META.map(s => s.id).concat(['other'])));
  const [indRows, setIndRows] = useState([]);
  const [aiSym, setAiSym] = useState('');
  const [aiType, setAiType] = useState('earnings');
  const [aiHist, setAiHist] = useState([]);
  const [aiLatest, setAiLatest] = useState(null);
  const [healthSym, setHealthSym] = useState('');
  const [healthText, setHealthText] = useState('');
  const [chartBlocks, setChartBlocks] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const {sortConfig, onSort, resetSort} = useTableSort();

  useEffect(() => {
    resetSort();
  }, [tab, resetSort]);

  const sortedIndRows = useMemo(
    () => sortRows(indRows, sortConfig, getAdvisorSortValue),
    [indRows, sortConfig],
  );
  const sortedAiHist = useMemo(
    () => sortRows(aiHist, sortConfig, getAdvisorSortValue),
    [aiHist, sortConfig],
  );

  const levelsBySymbol = useMemo(() => buildLevelsLookup(sigRows), [sigRows]);

  const tierGrouped = useMemo(
    () => groupLatestSignalsByTier(sigRows, levelsBySymbol),
    [sigRows, levelsBySymbol],
  );

  const extraGrouped = useMemo(
    () => ({
      monthly_setup: mapSetupRows(monthlyRows, levelsBySymbol),
      custom_rs: mapSetupRows(customRows, levelsBySymbol),
      monday_pwh: mapSetupRows(mondayRows, levelsBySymbol),
    }),
    [customRows, levelsBySymbol, mondayRows, monthlyRows],
  );

  const activeSetupIds = useMemo(() => {
    const active = new Set();
    for (const setup of SETUP_META) {
      const rows =
        setup.tier != null && setup.tier !== '__other__'
          ? tierGrouped[setup.id] || []
          : extraGrouped[setup.id] || [];
      if (rows.length) active.add(setup.id);
    }
    if ((tierGrouped.other || []).length) active.add('other');
    return active;
  }, [extraGrouped, tierGrouped]);

  const loadSignals = useCallback(async ({silent = false} = {}) => {
    if (!silent) setLoading(true);
    setErr('');
    const cached = await readAdvisorSignalsCache();
    if (cached.length) {
      setSigRows(cached);
      if (!silent) setLoading(false);
    }
    try {
      const [latestRes, monthlyRes, customRes, mondayRes] = await Promise.all([
        signalsService.fetchLatestSignals({limit: 200}),
        advisorService.fetchMonthlyMacdSetup(300).catch(() => null),
        advisorService.fetchCustomRsMacdSetup({limit: 400, setup_mode: 'or_signal'}).catch(() => null),
        advisorService.fetchMondayPrevWeekHighCross({limit: 500}).catch(() => null),
      ]);
      const rows = extractApiRows(latestRes);
      setSigRows(rows);
      await writeAdvisorSignalsCache(rows);
      setMonthlyRows(extractApiRows(monthlyRes));
      setCustomRows(extractApiRows(customRes));
      setMondayRows(extractApiRows(mondayRes));
    } catch (e) {
      if (!cached.length) {
        setErr(String(e?.message || e));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadTrend = useCallback(async () => {
    setErr('');
    setLoading(true);
    try {
      const res = await advisorService.fetchIndicatorScreener({
        timeframe: 'weekly',
        indicator: 'rsi',
        condition: 'cross_above',
        universe: 'all',
        limit: 120,
      });
      setIndRows(extractApiRows(res));
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadChart = useCallback(async ({silent = false} = {}) => {
    if (!silent) setLoading(true);
    setErr('');
    try {
      const [customRes, latestRes] = await Promise.all([
        advisorService.fetchCustomRsMacdSetup({limit: 800, setup_mode: 'or_signal'}).catch(() => null),
        signalsService.fetchLatestSignals({limit: 200, timeoutMs: 20_000}).catch(() => null),
      ]);
      const customSetupRows = extractApiRows(customRes);
      const signals = extractApiRows(latestRes);
      setChartBlocks(buildChartFundamentalBlocks(customSetupRows, signals));
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (tab === 'sig') {
        loadSignals({silent: sigRows.length > 0});
      } else if (tab === 'trend') {
        loadTrend();
      } else if (tab === 'chart') {
        loadChart({silent: chartBlocks.length > 0});
      }
    }, [chartBlocks.length, loadChart, loadSignals, loadTrend, sigRows.length, tab]),
  );

  const toggleSetup = setupId => {
    setEnabledSetups(prev => {
      const next = new Set(prev);
      if (next.has(setupId)) next.delete(setupId);
      else next.add(setupId);
      return next;
    });
  };

  const totalVisibleRows = useMemo(() => {
    let n = 0;
    for (const setup of SETUP_META) {
      if (!enabledSetups.has(setup.id)) continue;
      const rows =
        setup.tier != null && setup.tier !== '__other__'
          ? tierGrouped[setup.id] || []
          : extraGrouped[setup.id] || [];
      n += rows.length;
    }
    if (enabledSetups.has('other')) n += tierGrouped.other?.length || 0;
    return n;
  }, [enabledSetups, extraGrouped, tierGrouped]);

  const loadAi = async () => {
    if (!aiSym.trim()) {
      setErr('Enter a symbol');
      return;
    }
    setErr('');
    setLoading(true);
    try {
      const res = await advisorService.fetchAnalysis(aiSym.trim().toUpperCase(), 12);
      const rows = Array.isArray(res?.data) ? res.data : [];
      setAiHist(rows);
      setAiLatest(rows[0] || null);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  const runAi = async () => {
    if (!aiSym.trim()) return;
    setLoading(true);
    setErr('');
    try {
      await advisorService.triggerAnalyze(aiSym.trim().toUpperCase(), aiType);
      await loadAi();
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  const runHealth = async () => {
    if (!healthSym.trim()) return;
    setLoading(true);
    setErr('');
    try {
      const res = await advisorService.fetchPortfolioHealth(healthSym.trim().toUpperCase());
      const r = res?.result;
      setHealthText(typeof r === 'string' ? r : JSON.stringify(r, null, 2));
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  const head = (
    <View style={{gap: 8}}>
      <Text style={mobileStyles.pageTitle}>Financial advisor</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {TABS.map(t => (
          <Pressable key={t.id} onPress={() => setTab(t.id)} style={[styles.chip, tab === t.id ? styles.chipOn : null]}>
            <Text style={[styles.chipText, tab === t.id ? styles.chipTextOn : null]}>{t.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {err ? (
        <View style={styles.errRow}>
          <Text style={styles.err}>{err}</Text>
          {tab === 'sig' ? (
            <Pressable onPress={() => loadSignals()} style={styles.retryBtn}>
              <Text style={styles.retryTxt}>Retry</Text>
            </Pressable>
          ) : tab === 'chart' ? (
            <Pressable onPress={() => loadChart()} style={styles.retryBtn}>
              <Text style={styles.retryTxt}>Retry</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {loading && ((tab === 'sig' && !sigRows.length) || (tab === 'chart' && !chartBlocks.length)) ? (
        <ActivityIndicator color={AYC.accent} />
      ) : null}
    </View>
  );

  if (tab === 'sig') {
    return (
      <MobileChrome navigation={navigation}>
        <ScrollView
          style={{flex: 1}}
          contentContainerStyle={styles.pad}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadSignals({silent: true});
              }}
            />
          }>
          {head}
          <Text style={mobileStyles.subtitle}>
            Live advisor setups · {totalVisibleRows} rows across {activeSetupIds.size} active tables
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {SETUP_META.map(setup => {
              const rows =
                setup.tier != null && setup.tier !== '__other__'
                  ? tierGrouped[setup.id] || []
                  : extraGrouped[setup.id] || [];
              const hasRows = rows.length > 0;
              const on = enabledSetups.has(setup.id);
              return (
                <Pressable
                  key={setup.id}
                  onPress={() => toggleSetup(setup.id)}
                  style={[styles.chip, on && hasRows ? styles.chipOn : null, !hasRows ? styles.chipDim : null]}>
                  <Text style={[styles.chipText, on && hasRows ? styles.chipTextOn : null]}>
                    {setup.label.split(' · ')[0]}
                    {hasRows ? ` (${rows.length})` : ''}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {SETUP_META.map(setup => {
            if (!enabledSetups.has(setup.id)) return null;
            const rows =
              setup.tier != null && setup.tier !== '__other__'
                ? tierGrouped[setup.id] || []
                : extraGrouped[setup.id] || [];
            const enabled = activeSetupIds.has(setup.id);
            return (
              <SetupLevelsTable
                key={setup.id}
                title={setup.label}
                rows={rows}
                enabled={enabled}
                tone={setup.tone}
              />
            );
          })}

          {enabledSetups.has('other') ? (
            <SetupLevelsTable
              title="Other live signals"
              rows={tierGrouped.other || []}
              enabled={activeSetupIds.has('other')}
            />
          ) : null}

          {!loading && totalVisibleRows === 0 ? (
            <Text style={styles.empty}>No advisor signals loaded yet. Pull down to refresh.</Text>
          ) : null}
        </ScrollView>
      </MobileChrome>
    );
  }

  if (tab === 'trend') {
    return (
      <MobileChrome navigation={navigation}>
        <FlatList
          data={sortedIndRows}
          keyExtractor={(it, i) => `${it.symbol}-${i}`}
          style={{flex: 1}}
          contentContainerStyle={styles.pad}
          ListHeaderComponent={
            <View>
              {head}
              <Text style={mobileStyles.subtitle}>Weekly RSI cross (screen) · {indRows.length} matches</Text>
              <View style={styles.thRow}>
                <SortableTableHeader label="Symbol" sortKey="symbol" sortConfig={sortConfig} onSort={onSort} style={{flex: 1}} textStyle={styles.th} />
                <SortableTableHeader label="RSI" sortKey="current_value" sortConfig={sortConfig} onSort={onSort} style={{width: 44}} textStyle={styles.th} />
                <SortableTableHeader label="Trend" sortKey="trend" sortConfig={sortConfig} onSort={onSort} style={{flex: 0.8}} textStyle={styles.th} />
                <SortableTableHeader label="Score" sortKey="score" sortConfig={sortConfig} onSort={onSort} style={{width: 48}} textStyle={styles.th} />
              </View>
            </View>
          }
          renderItem={({item, index}) => (
            <View style={[styles.tr, index % 2 === 0 ? styles.trAlt : null]}>
              <Text style={[styles.td, {flex: 1, fontWeight: '800'}]}>{item.symbol}</Text>
              <Text style={[styles.td, {width: 44}]}>{item.current_value != null ? Number(item.current_value).toFixed(1) : '—'}</Text>
              <Text style={[styles.td, {flex: 0.8}]} numberOfLines={1}>
                {item.trend || '—'}
              </Text>
              <Text style={[styles.td, {width: 48}]}>{item.signal_score != null ? String(item.signal_score) : '—'}</Text>
            </View>
          )}
        />
      </MobileChrome>
    );
  }

  if (tab === 'chart') {
    return (
      <MobileChrome navigation={navigation}>
        <ScrollView
          style={{flex: 1}}
          contentContainerStyle={styles.pad}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadChart({silent: true});
              }}
            />
          }>
          {head}
          <Text style={mobileStyles.subtitle}>RS daily / weekly / monthly setup screener</Text>
          {chartBlocks.map(block => (
            <ChartFundamentalTable key={block.id} block={block} />
          ))}
          {!loading && !chartBlocks.some(b => b.rows.length) ? (
            <Text style={styles.empty}>No RS setup rows loaded. Pull down to refresh.</Text>
          ) : null}
        </ScrollView>
      </MobileChrome>
    );
  }

  if (tab === 'ai') {
    return (
      <MobileChrome navigation={navigation}>
        <ScrollView style={{flex: 1}} contentContainerStyle={styles.pad}>
          {head}
          <View style={styles.rowInp}>
            <TextInput style={styles.inp} placeholder="Symbol" placeholderTextColor={AYC.textMuted} value={aiSym} onChangeText={setAiSym} autoCapitalize="characters" />
            <Pressable style={[styles.chipSm, aiType === 'earnings' ? styles.chipOn : null]} onPress={() => setAiType('earnings')}>
              <Text style={[styles.mini, aiType === 'earnings' ? styles.chipTextOn : null]}>Earnings</Text>
            </Pressable>
            <Pressable style={[styles.chipSm, aiType === 'weekly' ? styles.chipOn : null]} onPress={() => setAiType('weekly')}>
              <Text style={[styles.mini, aiType === 'weekly' ? styles.chipTextOn : null]}>Weekly</Text>
            </Pressable>
          </View>
          <View style={styles.rowBtn}>
            <Pressable style={styles.btn} onPress={loadAi}>
              <Text style={styles.btnTxt}>Load</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnGhost]} onPress={runAi}>
              <Text style={[styles.btnTxt, {color: AYC.accent}]}>Run analysis</Text>
            </Pressable>
          </View>
          {aiLatest ? (
            <View style={styles.aiBox}>
              <Text style={styles.aiRating}>{String(aiLatest.rating || '—').toUpperCase()}</Text>
              <Text style={styles.aiConf}>Confidence: {aiLatest.confidence ?? '—'}%</Text>
              <Text style={styles.aiSum}>{aiLatest.summary || '—'}</Text>
            </View>
          ) : null}
          <Text style={styles.blockTitle}>Analysis history</Text>
          <View style={styles.thRow}>
            <SortableTableHeader label="Type" sortKey="analysis_type" sortConfig={sortConfig} onSort={onSort} style={{flex: 0.8}} textStyle={styles.th} />
            <SortableTableHeader label="Rating" sortKey="rating" sortConfig={sortConfig} onSort={onSort} style={{flex: 0.6}} textStyle={styles.th} />
            <SortableTableHeader label="Conf" sortKey="confidence" sortConfig={sortConfig} onSort={onSort} style={{width: 44}} textStyle={styles.th} />
            <SortableTableHeader label="Date" sortKey="date" sortConfig={sortConfig} onSort={onSort} style={{flex: 1}} textStyle={styles.th} />
          </View>
          {sortedAiHist.map((r, i) => (
            <View key={r.id || i} style={[styles.tr, i % 2 === 1 ? styles.trAlt : null]}>
              <Text style={[styles.td, {flex: 0.8}]} numberOfLines={1}>
                {r.analysis_type}
              </Text>
              <Text style={[styles.td, {flex: 0.6}]}>{r.rating || '—'}</Text>
              <Text style={[styles.td, {width: 44}]}>{r.confidence ?? '—'}</Text>
              <Text style={[styles.td, {flex: 1, fontSize: AYC.type.cardLabel}]} numberOfLines={2}>
                {String(r.created_at || '').slice(0, 10)}
              </Text>
            </View>
          ))}
        </ScrollView>
      </MobileChrome>
    );
  }

  return (
    <MobileChrome navigation={navigation}>
      <ScrollView style={{flex: 1}} contentContainerStyle={styles.pad}>
        {head}
        <Text style={mobileStyles.subtitle}>Portfolio health check (single symbol)</Text>
        <TextInput
          style={styles.inp}
          placeholder="Symbol (e.g. RELIANCE)"
          placeholderTextColor={AYC.textMuted}
          value={healthSym}
          onChangeText={setHealthSym}
          autoCapitalize="characters"
        />
        <Pressable style={styles.btn} onPress={runHealth}>
          <Text style={styles.btnTxt}>Check health</Text>
        </Pressable>
        {healthText ? (
          <View style={styles.healthBox}>
            <Text style={styles.healthTxt}>{healthText}</Text>
          </View>
        ) : null}
        <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => navigation.navigate('Portfolio')}>
          <Text style={[styles.btnTxt, {color: AYC.accent}]}>Portfolio manager</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => navigation.navigate('Alerts')}>
          <Text style={[styles.btnTxt, {color: AYC.accent}]}>Stock alerts</Text>
        </Pressable>
      </ScrollView>
    </MobileChrome>
  );
}

const styles = StyleSheet.create({
  pad: mobilePad,
  chipRow: {flexDirection: 'row', gap: 8, paddingVertical: 4},
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: AYC.accent,
    backgroundColor: AYC.card,
  },
  chipOn: {backgroundColor: AYC.appBar, borderColor: AYC.appBar},
  chipDim: {opacity: 0.45},
  chipText: {fontSize: AYC.type.caption, fontWeight: '800', color: AYC.accent},
  chipTextOn: {color: '#fff'},
  chipSm: {paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: AYC.accent},
  mini: {fontSize: AYC.type.caption, fontWeight: '800', color: AYC.accent},
  err: {color: AYC.negative, fontSize: AYC.type.caption, flex: 1},
  errRow: {flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap'},
  retryBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: AYC.negative,
  },
  retryTxt: {color: AYC.negative, fontWeight: '800', fontSize: AYC.type.caption},
  empty: {paddingVertical: 16, color: AYC.textMuted, textAlign: 'center', fontSize: AYC.type.body},
  chartHint: {fontSize: AYC.type.caption, color: AYC.textMuted, paddingHorizontal: 4, marginBottom: 4},
  setupBlock: {marginTop: 12},
  setupTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 6,
  },
  setupTitleOn: {backgroundColor: AYC.appBar},
  setupTitleOff: {backgroundColor: '#e5e7eb'},
  setupTitle: {fontSize: AYC.type.body, fontWeight: '800', color: AYC.text, flex: 1},
  setupTitleTextOn: {color: '#fff'},
  setupCount: {fontSize: AYC.type.caption, fontWeight: '800', color: AYC.textMuted, marginLeft: 8},
  colSym: {flex: 1, minWidth: 64},
  colTv: {width: 28, alignItems: 'center', justifyContent: 'center'},
  colLvl: {flex: 1, minWidth: 68},
  cfSym: {width: 88},
  cfTv: {width: 28, alignItems: 'center', justifyContent: 'center'},
  cfSector: {width: 96},
  cfNum: {width: 72, textAlign: 'right'},
  cfRs: {width: 64, textAlign: 'right'},
  cfDi: {width: 44, textAlign: 'right'},
  cfRating: {width: 64, textAlign: 'center'},
  cfHorizon: {width: 80},
  rsPos: {color: AYC.positive},
  symBold: {fontWeight: '800'},
  thRow: {flexDirection: 'row', backgroundColor: AYC.appBar, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 8},
  th: mobileStyles.th,
  tr: {flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center'},
  trAlt: {backgroundColor: '#f0fdf4'},
  trBull: {backgroundColor: '#f0fdf4'},
  trBear: {backgroundColor: '#fff1f2'},
  td: mobileStyles.td,
  btn: {backgroundColor: AYC.appBar, paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginTop: 8},
  btnGhost: {backgroundColor: 'transparent', borderWidth: 1, borderColor: AYC.accent},
  btnTxt: {color: '#fff', fontWeight: '800', fontSize: AYC.type.body},
  rowInp: {flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap'},
  inp: {
    flex: 1,
    minWidth: 120,
    borderWidth: 1,
    borderColor: AYC.cardBorder,
    borderRadius: 10,
    padding: 10,
    fontSize: AYC.type.body,
    color: AYC.text,
    backgroundColor: AYC.card,
  },
  rowBtn: {flexDirection: 'row', gap: 10},
  aiBox: {backgroundColor: AYC.accentSoft, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: AYC.cardBorder},
  aiRating: {fontSize: AYC.type.metricSm, fontWeight: '900', color: AYC.positive},
  aiConf: {fontSize: AYC.type.body, fontWeight: '700', marginTop: 4},
  aiSum: {fontSize: AYC.type.body, color: AYC.text, marginTop: 8, lineHeight: 18},
  blockTitle: {fontSize: AYC.type.metricSm, fontWeight: '800', marginTop: 12, color: AYC.text},
  healthBox: {backgroundColor: AYC.accentSoft, padding: 12, borderRadius: 12, marginTop: 8},
  healthTxt: {fontSize: AYC.type.body, color: AYC.text, lineHeight: 20},
});
